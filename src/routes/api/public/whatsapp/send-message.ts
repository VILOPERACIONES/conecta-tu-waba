import { createFileRoute } from "@tanstack/react-router";

// Endpoint público llamado por instancias n8n para enviar mensajes de WhatsApp
// a través de Meta Cloud API. n8n NUNCA recibe el access token real; solo envía
// client_id + secreto compartido y este endpoint hace la llamada a Meta.
//
// Autenticación: header `X-N8N-Webhook-Secret` debe coincidir con el secreto
// del cliente (`n8n_webhook_secret_encrypted`).
//
// Body:
// { "client_id": "uuid", "to": "5219991234567", "message": "texto", "type": "text" }
export const Route = createFileRoute("/api/public/whatsapp/send-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = request.headers.get("x-n8n-webhook-secret") ?? "";
          const body = (await request.json().catch(() => null)) as {
            client_id?: string;
            to?: string;
            message?: string;
            type?: string;
          } | null;

          if (!body || !body.client_id || !body.to || !body.message) {
            return Response.json(
              { ok: false, error: "missing_params", detail: "client_id, to y message son requeridos" },
              { status: 400 },
            );
          }
          const type = (body.type ?? "text").toLowerCase();
          if (type !== "text") {
            return Response.json({ ok: false, error: "unsupported_type" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1) Buscar cliente + secreto n8n
          const { data: client, error: cErr } = await supabaseAdmin
            .from("clients")
            .select("id, n8n_enabled, n8n_webhook_secret_encrypted")
            .eq("id", body.client_id)
            .maybeSingle();
          if (cErr || !client) {
            return Response.json({ ok: false, error: "client_not_found" }, { status: 404 });
          }
          if (!client.n8n_webhook_secret_encrypted) {
            return Response.json({ ok: false, error: "n8n_not_configured" }, { status: 403 });
          }
          if (!secret || secret !== client.n8n_webhook_secret_encrypted) {
            return Response.json({ ok: false, error: "invalid_secret" }, { status: 401 });
          }

          // 2) Cuenta WhatsApp conectada del cliente
          const { data: acct, error: aErr } = await supabaseAdmin
            .from("whatsapp_accounts")
            .select("id, phone_number_id, token_encrypted, status")
            .eq("client_id", client.id)
            .eq("status", "connected")
            .order("connected_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (aErr || !acct || !acct.phone_number_id || !acct.token_encrypted) {
            return Response.json(
              { ok: false, error: "no_connected_account" },
              { status: 409 },
            );
          }

          const version = process.env.META_GRAPH_API_VERSION ?? "v25.0";
          const url = `https://graph.facebook.com/${version}/${acct.phone_number_id}/messages`;
          const metaBody = {
            messaging_product: "whatsapp",
            to: body.to,
            type: "text",
            text: { body: body.message },
          };

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${acct.token_encrypted}`,
            },
            body: JSON.stringify(metaBody),
          });
          const metaJson: any = await res.json().catch(() => ({}));

          if (!res.ok) {
            console.error("[send-message] Meta error", res.status, metaJson);
            return Response.json(
              { ok: false, error: "meta_error", status: res.status, detail: metaJson },
              { status: 502 },
            );
          }

          return Response.json({ ok: true, meta: metaJson });
        } catch (err: any) {
          console.error("[send-message] error", err);
          return Response.json(
            { ok: false, error: "server_error", detail: String(err?.message ?? err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
