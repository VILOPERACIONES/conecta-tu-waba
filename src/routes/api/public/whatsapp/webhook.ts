import { createFileRoute } from "@tanstack/react-router";

// Meta calls this endpoint for webhook verification (GET) and events (POST).
// GET: verifies hub.verify_token and echoes hub.challenge.
// POST: stores every payload, resolves the whatsapp_account by phone_number_id,
// and forwards the original body to n8n with an internal signature header.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        console.warn("[wa-webhook] verify failed", { mode, hasToken: !!token });
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        // Respond 200 fast; do heavy work but do not throw.
        const rawBody = await request.text();
        try {
          const payload = JSON.parse(rawBody);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Best-effort: find phone_number_id inside entry[].changes[].value.metadata.phone_number_id
          let phoneNumberId: string | undefined;
          let eventType: string | undefined;
          try {
            const entry = payload?.entry?.[0];
            const change = entry?.changes?.[0];
            eventType = change?.field ?? undefined;
            phoneNumberId = change?.value?.metadata?.phone_number_id;
          } catch { /* ignore malformed */ }

          let accountId: string | null = null;
          if (phoneNumberId) {
            const { data } = await supabaseAdmin
              .from("whatsapp_accounts")
              .select("id")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            accountId = data?.id ?? null;
          }

          await supabaseAdmin.from("webhook_events").insert({
            whatsapp_account_id: accountId,
            event_type: eventType ?? null,
            payload,
          });

          // Forward to n8n
          const n8nUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;
          const n8nSecret = process.env.N8N_WEBHOOK_SECRET;
          if (n8nUrl) {
            fetch(n8nUrl, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(n8nSecret ? { "x-internal-secret": n8nSecret } : {}),
              },
              body: rawBody,
            }).catch((err) => console.error("[wa-webhook] n8n forward failed", err));
          }
        } catch (err) {
          console.error("[wa-webhook] error", err);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
