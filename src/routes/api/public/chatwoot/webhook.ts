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

        // We only care about outgoing messages authored by human agents.
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
