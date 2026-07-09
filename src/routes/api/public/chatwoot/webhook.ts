import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Chatwoot agent webhook.
//
// Chatwoot posts JSON events here. When a human agent sends an outgoing
// message (not the bot mirror), we forward it to WhatsApp Cloud API using
// the client's connected phone_number_id + token, and record the mapping to
// prevent loops.
//
// Auth: HMAC-SHA256 of raw body with the client's chatwoot_webhook_secret_encrypted,
// sent by Chatwoot in the "X-Chatwoot-Signature" header (hex). If no secret
// is configured for the client, the webhook falls back to just matching
// (account_id, inbox_id) and logs a warning — recommend setting a secret.
//
// The route ALWAYS responds 200 to avoid Chatwoot retries on our own logic
// errors; failures are captured in chatwoot_integration_logs.
export const Route = createFileRoute("/api/public/chatwoot/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ ok: true, ignored: "invalid_json" });
        }

        const eventType: string = event?.event ?? "";
        const account = event?.account ?? {};
        const inbox = event?.inbox ?? {};
        const accountId = account?.id != null ? String(account.id) : null;
        const inboxId = inbox?.id != null ? String(inbox.id) : null;

        if (!accountId || !inboxId) {
          return Response.json({ ok: true, ignored: "missing_account_or_inbox" });
        }

        const {
          loadChatwootConfigForWebhook,
          lookupWaIdForConversation,
          chatwootMessageAlreadyMirrored,
          recordChatwootAgentSend,
          logChatwootEvent,
          applyChatwootConversationState,
          checkChatwootRateLimit,
        } = await import("@/lib/chatwoot-sync.server");

        const cfg = await loadChatwootConfigForWebhook(accountId, inboxId);
        if (!cfg) {
          return Response.json({ ok: true, ignored: "no_matching_client" });
        }

        // HMAC verification (if secret configured).
        const signature = request.headers.get("x-chatwoot-signature") ?? "";
        if (cfg.webhook_secret) {
          try {
            const expected = createHmac("sha256", cfg.webhook_secret)
              .update(rawBody)
              .digest("hex");
            const a = Buffer.from(signature);
            const b = Buffer.from(expected);
            const valid = a.length === b.length && timingSafeEqual(a, b);
            if (!valid) {
              await logChatwootEvent(cfg.client_id, "webhook_invalid_signature", "incoming", "error", {
                event_type: eventType,
              });
              return new Response("invalid signature", { status: 401 });
            }
          } catch (err) {
            await logChatwootEvent(cfg.client_id, "webhook_signature_error", "incoming", "error", {
              event_type: eventType,
              error_message: String((err as any)?.message ?? err).slice(0, 500),
            });
            return new Response("invalid signature", { status: 401 });
          }
        }

        // Rate limit per client (isolates one noisy tenant; never blocks Meta).
        const rl = await checkChatwootRateLimit(cfg.client_id);
        if (!rl.allowed) {
          await logChatwootEvent(cfg.client_id, "rate_limited", "incoming", "ignored", {
            event_type: eventType,
            response_payload: { reason: rl.reason, retry_after_ms: rl.retry_after_ms },
          });
          return new Response("rate limited", {
            status: 429,
            headers: { "retry-after": String(Math.ceil(rl.retry_after_ms / 1000)) },
          });
        }

        // ---- conversation_updated / labels-changed events ----
        if (
          eventType === "conversation_updated" ||
          eventType === "conversation_status_changed" ||
          eventType === "conversation_resolved" ||
          eventType === "conversation_opened" ||
          eventType === "conversation_reopened"
        ) {
          const convId =
            event?.id != null
              ? String(event.id)
              : event?.conversation?.id != null
              ? String(event.conversation.id)
              : null;
          if (!convId) return Response.json({ ok: true, ignored: "no_conversation_id" });

          const labelsField = event?.labels ?? event?.additional_attributes?.labels ?? null;
          const labels: string[] | null = Array.isArray(labelsField)
            ? labelsField.map((l: any) => (typeof l === "string" ? l : l?.title ?? "")).filter(Boolean)
            : null;
          const status: string | null = event?.status ?? event?.conversation?.status ?? null;
          const assigneeId =
            event?.meta?.assignee?.id != null
              ? String(event.meta.assignee.id)
              : event?.assignee_id != null
              ? String(event.assignee_id)
              : null;

          const applied = await applyChatwootConversationState({
            client_id: cfg.client_id,
            chatwoot_conversation_id: convId,
            labels,
            status,
            assignee_id: assigneeId,
            pause_label: cfg.pause_label,
            pause_on_assigned: cfg.pause_on_assigned,
          });

          const transitioned =
            applied.previous_bot_paused !== null &&
            applied.previous_bot_paused !== applied.bot_paused;
          const stateEvent = transitioned
            ? applied.bot_paused
              ? "bot_paused_by_label"
              : "bot_resumed"
            : "conversation_state_updated";

          await logChatwootEvent(cfg.client_id, stateEvent, "incoming", "success", {
            chatwoot_conversation_id: convId,
            wa_id: applied.wa_id,
            response_payload: {
              labels,
              status,
              assignee_id: assigneeId,
              bot_paused: applied.bot_paused,
            },
          });
          return Response.json({ ok: true, applied: stateEvent });
        }

        // We only care about message_created below.
        if (eventType !== "message_created") {
          await logChatwootEvent(cfg.client_id, `webhook_${eventType || "unknown"}`, "incoming", "ignored", {
            event_type: eventType,
          });
          return Response.json({ ok: true, ignored: "unhandled_event" });
        }

        const messageType: string = event?.message_type ?? "";
        const isPrivate = !!event?.private;
        const senderType: string = event?.sender?.type ?? event?.sender_type ?? "";
        const contentAttributes = event?.content_attributes ?? {};
        const sourceTag: string | null = contentAttributes?.source ?? null;
        const chatwootMessageId = event?.id != null ? String(event.id) : null;
        const conversationId =
          event?.conversation?.id != null
            ? String(event.conversation.id)
            : event?.conversation_id != null
            ? String(event.conversation_id)
            : null;

        if (!chatwootMessageId || !conversationId) {
          return Response.json({ ok: true, ignored: "missing_ids" });
        }

        if (messageType !== "outgoing" || isPrivate) {
          await logChatwootEvent(cfg.client_id, "webhook_ignored_not_outgoing", "incoming", "ignored", {
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
            event_type: eventType,
          });
          return Response.json({ ok: true, ignored: "not_public_outgoing" });
        }

        // Anti-loop 1: our own bot/meta mirrors carry source in content_attributes.
        if (sourceTag === "bot" || sourceTag === "meta" || sourceTag === "meta_api") {
          await logChatwootEvent(cfg.client_id, "webhook_ignored_bot_mirror", "incoming", "ignored", {
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
            source: sourceTag,
          });
          return Response.json({ ok: true, ignored: "bot_mirror" });
        }

        // Anti-loop 2: message already mirrored in DB.
        if (await chatwootMessageAlreadyMirrored(cfg.client_id, chatwootMessageId)) {
          await logChatwootEvent(cfg.client_id, "webhook_duplicate", "incoming", "ignored", {
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
          });
          return Response.json({ ok: true, ignored: "already_mirrored" });
        }

        // Only accept messages sent by human agents ("user"). Bot integrations
        // sometimes appear with sender.type === "agent_bot".
        if (senderType && senderType !== "user" && senderType !== "User") {
          await logChatwootEvent(cfg.client_id, "webhook_ignored_non_agent", "incoming", "ignored", {
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
            sender_type: senderType,
          });
          return Response.json({ ok: true, ignored: "non_human_sender" });
        }

        const content: string = String(event?.content ?? "").trim();
        if (!content) {
          return Response.json({ ok: true, ignored: "empty_content" });
        }

        // Route to Meta.
        const waId = await lookupWaIdForConversation(cfg.client_id, conversationId);
        if (!waId) {
          await logChatwootEvent(cfg.client_id, "webhook_no_wa_id", "incoming", "error", {
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
          });
          return Response.json({ ok: true, ignored: "no_wa_id_mapping" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: acct } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("id, phone_number_id, token_encrypted, status")
          .eq("client_id", cfg.client_id)
          .eq("status", "connected")
          .order("connected_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!acct?.phone_number_id || !acct.token_encrypted) {
          await logChatwootEvent(cfg.client_id, "webhook_no_meta_account", "outgoing", "error", {
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
          });
          return Response.json({ ok: true, ignored: "no_meta_account" });
        }

        const version = process.env.META_GRAPH_API_VERSION ?? "v25.0";
        const url = `https://graph.facebook.com/${version}/${acct.phone_number_id}/messages`;
        const metaBody = {
          messaging_product: "whatsapp",
          to: waId,
          type: "text",
          text: { body: content.slice(0, 4096) },
        };

        let httpStatus = 0;
        let metaJson: any = null;
        let ok = false;
        let networkErr: string | null = null;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${acct.token_encrypted}`,
            },
            body: JSON.stringify(metaBody),
          });
          httpStatus = res.status;
          metaJson = await res.json().catch(() => ({}));
          ok = res.ok;
        } catch (err: any) {
          networkErr = String(err?.message ?? err).slice(0, 500);
        }

        const metaMessageId = ok ? metaJson?.messages?.[0]?.id ?? null : null;
        const errMsg = !ok
          ? metaJson?.error?.message ?? networkErr ?? `HTTP ${httpStatus}`
          : null;

        await supabaseAdmin.from("whatsapp_send_logs").insert({
          client_id: cfg.client_id,
          whatsapp_account_id: acct.id,
          phone_number_id: acct.phone_number_id,
          to_wa_id: waId,
          message_type: "text",
          message_preview: content.slice(0, 200),
          request_payload: metaBody,
          response_status: httpStatus || null,
          response_body: metaJson ?? (networkErr ? { network_error: networkErr } : null),
          meta_message_id: metaMessageId,
          meta_message_status: ok ? "accepted" : null,
          success: ok,
          error_code: metaJson?.error?.code != null ? String(metaJson.error.code) : null,
          error_subcode: metaJson?.error?.error_subcode != null ? String(metaJson.error.error_subcode) : null,
          error_type: metaJson?.error?.type ?? (networkErr ? "network_error" : null),
          error_message: errMsg,
          fbtrace_id: metaJson?.error?.fbtrace_id ?? null,
          source: "chatwoot_agent",
          inbound_message_id: null,
        } as any);

        await recordChatwootAgentSend({
          client_id: cfg.client_id,
          wa_id: waId,
          chatwoot_message_id: chatwootMessageId,
          chatwoot_conversation_id: conversationId,
          meta_message_id: metaMessageId,
        });

        await logChatwootEvent(
          cfg.client_id,
          "agent_message_sent",
          "outgoing",
          ok ? "success" : "error",
          {
            wa_id: waId,
            chatwoot_message_id: chatwootMessageId,
            chatwoot_conversation_id: conversationId,
            wa_message_id: metaMessageId,
            http_status: httpStatus || null,
            error_message: errMsg,
          },
        );

        return Response.json({ ok: true, forwarded: ok, meta_message_id: metaMessageId });
      },
    },
  },
});
