import { createFileRoute } from "@tanstack/react-router";

// Meta calls this endpoint for webhook verification (GET) and events (POST).
// GET: verifies hub.verify_token and echoes hub.challenge.
// POST:
//   1. Guarda inmediatamente el payload crudo en meta_webhook_events (una fila por change).
//   2. Detecta si es mensaje entrante o status update y extrae campos útiles.
//   3. Si el cliente asociado tiene n8n habilitado y URL configurada, reenvía y
//      registra cada intento en n8n_forward_logs (sin exponer el secreto real).
//   4. Si es status update, actualiza el whatsapp_send_logs correspondiente.
//   5. Siempre responde 200 a Meta rápidamente.
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
        const rawBody = await request.text();
        // Serializar headers sin secretos sensibles.
        const rawHeaders: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          const lk = k.toLowerCase();
          if (lk === "authorization" || lk === "cookie" || lk.includes("token") || lk.includes("secret")) return;
          rawHeaders[k] = v;
        });

        const reqUrl = new URL(request.url);
        const queryParams: Record<string, string> = {};
        reqUrl.searchParams.forEach((v, k) => { queryParams[k] = v; });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 0) Guardar SIEMPRE el payload crudo, antes de cualquier validación.
        let parsedBody: any = null;
        let parseError: string | null = null;
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : null;
        } catch (err: any) {
          parseError = `JSON parse error: ${String(err?.message ?? err).slice(0, 300)}`;
        }

        // Detectar phone_number_id en cualquier lugar del payload (puede faltar en tests de Meta).
        let detectedPhoneId: string | null = null;
        try {
          const entries: any[] = Array.isArray(parsedBody?.entry) ? parsedBody.entry : [];
          for (const entry of entries) {
            const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const ch of changes) {
              const pid = ch?.value?.metadata?.phone_number_id;
              if (pid) { detectedPhoneId = pid; break; }
            }
            if (detectedPhoneId) break;
          }
        } catch {}

        // Heurística para detectar el botón "Test" de Meta:
        // suele mandar un payload sin metadata.phone_number_id, con IDs ficticios
        // (ej. "WHATSAPP_BUSINESS_ACCOUNT_ID") o messages con from de ejemplo.
        const bodyStr = rawBody || "";
        const isMetaTest =
          !detectedPhoneId && (
            /WHATSAPP_BUSINESS_ACCOUNT_ID|PHONE_NUMBER|WHATSAPP_ID|MESSAGE_ID/i.test(bodyStr) ||
            (parsedBody?.entry && !detectedPhoneId)
          );

        const rawInsert = await supabaseAdmin
          .from("raw_meta_webhook_events")
          .insert({
            method: "POST",
            url: request.url,
            query_params: queryParams,
            headers: rawHeaders,
            body_raw: bodyStr.slice(0, 20000),
            body_json: parsedBody,
            phone_number_id: detectedPhoneId,
            object_type: parsedBody?.object ?? null,
            is_meta_test: isMetaTest,
            processing_error: parseError ?? (!detectedPhoneId ? "phone_number_id not found" : null),
            processed: false,
          })
          .select("id")
          .single();

        if (isMetaTest) {
          console.log("[wa-webhook] Meta Test button event received", { id: rawInsert.data?.id });
        }
        if (!detectedPhoneId) {
          console.warn("[wa-webhook] event without phone_number_id", { id: rawInsert.data?.id, is_meta_test: isMetaTest });
        }

        // Si no hay body válido o no hay phone_number_id, respondemos 200 y no procesamos más.
        if (!parsedBody || !detectedPhoneId) {
          return new Response("ok", { status: 200 });
        }

        try {
          const payload = parsedBody;

          const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];

          // 1) Recolectar phone_number_ids presentes para mapear cuentas.
          const phoneNumberIds = new Set<string>();
          for (const entry of entries) {
            const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const ch of changes) {
              const pid = ch?.value?.metadata?.phone_number_id;
              if (pid) phoneNumberIds.add(pid);
            }
          }

          const accountsByPhone = new Map<
            string,
            {
              account_id: string;
              client_id: string;
              n8n_enabled: boolean;
              n8n_webhook_url: string | null;
              n8n_webhook_secret_encrypted: string | null;
            }
          >();

          if (phoneNumberIds.size > 0) {
            const { data: accounts } = await supabaseAdmin
              .from("whatsapp_accounts")
              .select(
                "id, phone_number_id, client_id, clients:client_id(n8n_enabled, n8n_webhook_url, n8n_webhook_secret_encrypted)",
              )
              .in("phone_number_id", Array.from(phoneNumberIds));

            for (const acct of accounts ?? []) {
              if (!acct.phone_number_id) continue;
              const client: any = (acct as any).clients ?? {};
              accountsByPhone.set(acct.phone_number_id, {
                account_id: acct.id,
                client_id: acct.client_id,
                n8n_enabled: !!client.n8n_enabled,
                n8n_webhook_url: client.n8n_webhook_url ?? null,
                n8n_webhook_secret_encrypted: client.n8n_webhook_secret_encrypted ?? null,
              });
            }
          }

          // 2) Procesar cada change: guardar meta_webhook_events y decidir reenvío.
          type Forward = {
            client_id: string;
            phone_number_id: string;
            url: string;
            secret: string | null;
            entries: any[];
            event_ids: string[];
          };
          const forwards = new Map<string, Forward>();

          for (const entry of entries) {
            const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
              const field: string | null = change?.field ?? null;
              const value: any = change?.value ?? {};
              const phoneNumberId: string | null = value?.metadata?.phone_number_id ?? null;
              const account = phoneNumberId ? accountsByPhone.get(phoneNumberId) : undefined;

              // Extraer campos útiles según tipo de change.
              const msg = Array.isArray(value?.messages) ? value.messages[0] : null;
              const stt = Array.isArray(value?.statuses) ? value.statuses[0] : null;

              let event_kind: string | null = null;
              let wa_message_id: string | null = null;
              let from_wa_id: string | null = null;
              let to_phone_number: string | null = value?.metadata?.display_phone_number ?? null;
              let message_type: string | null = null;
              let text_body: string | null = null;
              let status: string | null = null;
              let error_code: string | null = null;
              let error_title: string | null = null;
              let error_message: string | null = null;
              let error_details: any = null;

              if (msg) {
                event_kind = "message";
                wa_message_id = msg.id ?? null;
                from_wa_id = msg.from ?? null;
                message_type = msg.type ?? null;
                text_body = msg?.text?.body ?? null;
              } else if (stt) {
                event_kind = "status";
                wa_message_id = stt.id ?? null;
                status = stt.status ?? null;
                const err = Array.isArray(stt?.errors) ? stt.errors[0] : null;
                if (err) {
                  error_code = err.code != null ? String(err.code) : null;
                  error_title = err.title ?? null;
                  error_message = err.message ?? err.error_data?.details ?? null;
                  error_details = err;
                }
              } else if (field) {
                event_kind = field;
              } else {
                event_kind = "unknown";
              }

              const processing_error = phoneNumberId && !account
                ? `No client found for phone_number_id=${phoneNumberId}`
                : null;

              // Insertar meta_webhook_events y recuperar id.
              const { data: insertedEvent } = await supabaseAdmin
                .from("meta_webhook_events")
                .insert({
                  client_id: account?.client_id ?? null,
                  whatsapp_account_id: account?.account_id ?? null,
                  phone_number_id: phoneNumberId,
                  direction: "inbound_from_meta",
                  field,
                  event_kind,
                  wa_message_id,
                  from_wa_id,
                  to_phone_number,
                  message_type,
                  text_body,
                  status,
                  error_code,
                  error_title,
                  error_message,
                  error_details,
                  raw_headers: rawHeaders,
                  raw_payload: {
                    object: payload?.object ?? null,
                    entry: [{ id: entry?.id ?? null, changes: [change] }],
                  },
                  processed: !!account,
                  processing_error,
                })
                .select("id")
                .single();

              // Mantener compatibilidad con webhook_events viejo.
              await supabaseAdmin.from("webhook_events").insert({
                whatsapp_account_id: account?.account_id ?? null,
                event_type: field,
                payload: {
                  object: payload?.object ?? null,
                  entry: [{ id: entry?.id ?? null, changes: [change] }],
                },
              });

              // Si es un status para un envío nuestro, actualizar whatsapp_send_logs.
              if (event_kind === "status" && wa_message_id && status) {
                await supabaseAdmin
                  .from("whatsapp_send_logs")
                  .update({
                    meta_message_status: status,
                    error_code: error_code,
                    error_message: error_message,
                    success: status === "delivered" || status === "read" || status === "sent",
                  })
                  .eq("meta_message_id", wa_message_id);
              }

              // Decidir reenvío a n8n.
              if (
                account &&
                account.n8n_enabled &&
                account.n8n_webhook_url &&
                account.n8n_webhook_url.length > 0 &&
                phoneNumberId
              ) {
                const key = account.client_id;
                const bucket =
                  forwards.get(key) ?? {
                    client_id: account.client_id,
                    phone_number_id: phoneNumberId,
                    url: account.n8n_webhook_url,
                    secret: account.n8n_webhook_secret_encrypted,
                    entries: [] as any[],
                    event_ids: [] as string[],
                  };
                bucket.entries.push({ id: entry?.id ?? null, changes: [change] });
                if (insertedEvent?.id) bucket.event_ids.push(insertedEvent.id);
                forwards.set(key, bucket);
              }
            }
          }

          // 3) Reenviar a n8n con logging detallado.
          for (const fwd of forwards.values()) {
            const requestPayload = {
              object: payload?.object ?? "whatsapp_business_account",
              entry: fwd.entries,
            };
            const body = JSON.stringify(requestPayload);
            const now = new Date().toISOString();
            const logHeaders = {
              "content-type": "application/json",
              "X-Client-ID": fwd.client_id,
              "X-Phone-Number-ID": fwd.phone_number_id,
              "X-N8N-Webhook-Secret": fwd.secret ? "***" : null,
              secret_present: !!fwd.secret,
            };
            (async () => {
              let responseStatus: number | null = null;
              let responseBody: string | null = null;
              let ok = false;
              let errorMessage: string | null = null;
              try {
                const res = await fetch(fwd.url, {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "X-Client-ID": fwd.client_id,
                    "X-Phone-Number-ID": fwd.phone_number_id,
                    ...(fwd.secret ? { "X-N8N-Webhook-Secret": fwd.secret } : {}),
                  },
                  body,
                });
                responseStatus = res.status;
                responseBody = (await res.text().catch(() => "")).slice(0, 4000);
                ok = res.ok;
                if (!ok) errorMessage = `HTTP ${res.status}: ${responseBody.slice(0, 500)}`;
              } catch (err: any) {
                errorMessage = String(err?.message ?? err).slice(0, 500);
                console.error("[wa-webhook] n8n forward failed", errorMessage);
              }

              await supabaseAdmin.from("n8n_forward_logs").insert({
                client_id: fwd.client_id,
                meta_webhook_event_id: fwd.event_ids[0] ?? null,
                phone_number_id: fwd.phone_number_id,
                n8n_webhook_url: fwd.url,
                request_headers: logHeaders,
                request_payload: requestPayload,
                response_status: responseStatus,
                response_body: responseBody,
                success: ok,
                error_message: errorMessage,
              });

              await supabaseAdmin
                .from("clients")
                .update({
                  n8n_last_delivery_at: now,
                  n8n_last_delivery_status: ok ? "success" : "error",
                  n8n_last_delivery_error: ok ? null : errorMessage,
                })
                .eq("id", fwd.client_id);
            })();
          }
          if (rawInsert.data?.id) {
            await supabaseAdmin
              .from("raw_meta_webhook_events")
              .update({ processed: true })
              .eq("id", rawInsert.data.id);
          }
        } catch (err: any) {
          console.error("[wa-webhook] error", err);
          if (rawInsert.data?.id) {
            await supabaseAdmin
              .from("raw_meta_webhook_events")
              .update({ processing_error: String(err?.message ?? err).slice(0, 500) })
              .eq("id", rawInsert.data.id);
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
