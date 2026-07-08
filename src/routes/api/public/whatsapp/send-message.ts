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

          let metaJson: any = null;
          let httpStatus = 0;
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
            networkErr = String(err?.message ?? err);
            console.error("[send-message] network error", networkErr);
          }

          const metaMessageId = ok ? metaJson?.messages?.[0]?.id ?? null : null;
          const errMsg = !ok
            ? metaJson?.error?.message ?? networkErr ?? "Fallo al enviar"
            : null;

          await supabaseAdmin.from("message_send_logs").insert({
            client_id: client.id,
            phone_number_id: acct.phone_number_id,
            to: String(body.to).replace(/[^\d]/g, ""),
            message_preview: String(body.message).slice(0, 200),
            status: ok ? "success" : "error",
            meta_message_id: metaMessageId,
            error_message: errMsg,
            raw_response: metaJson ?? (networkErr ? { network_error: networkErr } : null),
            source: "n8n",
            http_status: httpStatus || null,
            request_payload: metaBody,
          } as any);

          await supabaseAdmin.from("whatsapp_send_logs").insert({
            client_id: client.id,
            whatsapp_account_id: acct.id,
            phone_number_id: acct.phone_number_id,
            to_wa_id: String(body.to).replace(/[^\d]/g, ""),
            message_type: "text",
            message_preview: String(body.message).slice(0, 200),
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
            source: "n8n",
          } as any);

          if (!ok) {
            console.error("[send-message] Meta error", httpStatus, metaJson);
            return Response.json(
              { ok: false, error: "meta_error", status: httpStatus, detail: metaJson ?? { network_error: networkErr } },
              { status: 502 },
            );
          }

          return Response.json({ ok: true, message_id: metaMessageId, meta: metaJson });

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
