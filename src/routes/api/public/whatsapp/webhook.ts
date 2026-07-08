import { createFileRoute } from "@tanstack/react-router";

// Meta calls this endpoint for webhook verification (GET) and events (POST).
// GET: verifies hub.verify_token and echoes hub.challenge.
// POST: siempre guarda el payload en webhook_events. Si el cliente asociado
// tiene n8n habilitado y con URL configurada, reenvía el payload original a
// esa instancia de n8n. Nunca falla ni bloquea a Meta por errores de n8n.
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
        // Siempre responder 200 a Meta lo antes posible; el trabajo pesado no
        // debe lanzar errores hacia arriba.
        const rawBody = await request.text();
        try {
          const payload = JSON.parse(rawBody);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Meta puede enviar múltiples entries/changes en un solo POST.
          const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];

          // Recolectar todos los phone_number_id presentes para poder mapear
          // cada change al cliente correcto.
          const phoneNumberIds = new Set<string>();
          for (const entry of entries) {
            const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const ch of changes) {
              const pid = ch?.value?.metadata?.phone_number_id;
              if (pid) phoneNumberIds.add(pid);
            }
          }

          // Mapear phone_number_id -> { account_id, client }
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

          // Guardar un webhook_event por cada change y decidir reenvío por cliente.
          const forwards = new Map<
            string,
            {
              client_id: string;
              phone_number_id: string;
              url: string;
              secret: string | null;
              entries: any[];
            }
          >();

          for (const entry of entries) {
            const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
              const eventType: string | null = change?.field ?? null;
              const phoneNumberId: string | undefined =
                change?.value?.metadata?.phone_number_id;
              const account = phoneNumberId ? accountsByPhone.get(phoneNumberId) : undefined;

              await supabaseAdmin.from("webhook_events").insert({
                whatsapp_account_id: account?.account_id ?? null,
                event_type: eventType,
                payload: {
                  object: payload?.object ?? null,
                  entry: [{ id: entry?.id ?? null, changes: [change] }],
                },
              });

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
                  };
                bucket.entries.push({ id: entry?.id ?? null, changes: [change] });
                forwards.set(key, bucket);
              }
            }
          }

          // Reenviar a n8n. Actualiza el estado de entrega por cliente.
          // Nunca bloquea la respuesta 200 a Meta.
          for (const fwd of forwards.values()) {
            const body = JSON.stringify({
              object: payload?.object ?? "whatsapp_business_account",
              entry: fwd.entries,
            });
            (async () => {
              const now = new Date().toISOString();
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
                if (res.ok) {
                  await supabaseAdmin
                    .from("clients")
                    .update({
                      n8n_last_delivery_at: now,
                      n8n_last_delivery_status: "success",
                      n8n_last_delivery_error: null,
                    })
                    .eq("id", fwd.client_id);
                } else {
                  const text = await res.text().catch(() => "");
                  await supabaseAdmin
                    .from("clients")
                    .update({
                      n8n_last_delivery_at: now,
                      n8n_last_delivery_status: "error",
                      n8n_last_delivery_error: `HTTP ${res.status}: ${text.slice(0, 500)}`,
                    })
                    .eq("id", fwd.client_id);
                }
              } catch (err: any) {
                await supabaseAdmin
                  .from("clients")
                  .update({
                    n8n_last_delivery_at: now,
                    n8n_last_delivery_status: "error",
                    n8n_last_delivery_error: String(err?.message ?? err).slice(0, 500),
                  })
                  .eq("id", fwd.client_id);
                console.error("[wa-webhook] n8n forward failed", err);
              }
            })();
          }
        } catch (err) {
          console.error("[wa-webhook] error", err);
        }
        // Siempre 200 a Meta. Nunca bloquear el onboarding ni fallar por n8n.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
