import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("No autorizado");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

// Envía un mensaje de prueba de WhatsApp para un cliente dado, usando su cuenta
// conectada. El access token nunca sale del backend. Registra el intento en
// message_send_logs.
export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { client_id: string; to: string; message: string; type?: string }) =>
    z.object({
      client_id: z.string().uuid(),
      to: z.string().trim().min(4).max(30),
      message: z.string().trim().min(1).max(4096),
      type: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const type = (data.type ?? "text").toLowerCase();
    if (type !== "text") {
      return { ok: false, error: { message: "Tipo no soportado", type: "unsupported_type" } };
    }

    const to = normalizePhone(data.to);
    if (to.length < 6) {
      return { ok: false, error: { message: "Número de destino inválido", type: "invalid_to" } };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", data.client_id)
      .maybeSingle();
    if (!client) {
      return { ok: false, error: { message: "Cliente no encontrado", type: "client_not_found" } };
    }

    const { data: acct } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("id, phone_number_id, token_encrypted, status")
      .eq("client_id", client.id)
      .eq("status", "connected")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!acct || !acct.phone_number_id || !acct.token_encrypted) {
      const errMsg = "El cliente no tiene una cuenta de WhatsApp conectada con credenciales válidas.";
      await supabaseAdmin.from("message_send_logs").insert({
        client_id: client.id,
        phone_number_id: acct?.phone_number_id ?? null,
        to,
        message_preview: data.message.slice(0, 200),
        status: "error",
        error_message: errMsg,
        raw_response: null,
      });
      return { ok: false, error: { message: errMsg, type: "no_connected_account" } };
    }

    const version = process.env.META_GRAPH_API_VERSION ?? "v25.0";
    const url = `https://graph.facebook.com/${version}/${acct.phone_number_id}/messages`;
    const metaBody = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: data.message },
    };

    let metaJson: any = null;
    let httpStatus = 0;
    let ok = false;
    let networkErr: string | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acct.token_encrypted}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(metaBody),
      });
      httpStatus = res.status;
      metaJson = await res.json().catch(() => ({}));
      ok = res.ok;
    } catch (err: any) {
      networkErr = String(err?.message ?? err);
      console.error("[sendTestMessage] network error", networkErr);
    }

    const metaMessageId = ok ? metaJson?.messages?.[0]?.id ?? null : null;
    const metaError = !ok
      ? {
          message: metaJson?.error?.message ?? networkErr ?? "Fallo al enviar",
          type: metaJson?.error?.type ?? (networkErr ? "network_error" : "meta_error"),
          code: metaJson?.error?.code ?? null,
          error_subcode: metaJson?.error?.error_subcode ?? null,
          fbtrace_id: metaJson?.error?.fbtrace_id ?? null,
          http_status: httpStatus || null,
        }
      : null;

    await supabaseAdmin.from("message_send_logs").insert({
      client_id: client.id,
      phone_number_id: acct.phone_number_id,
      to,
      message_preview: data.message.slice(0, 200),
      status: ok ? "success" : "error",
      meta_message_id: metaMessageId,
      error_message: metaError?.message ?? null,
      raw_response: metaJson ?? (networkErr ? { network_error: networkErr } : null),
      source: "panel",
      http_status: httpStatus || null,
      request_payload: metaBody,
    } as any);


    if (!ok) {
      console.error("[sendTestMessage] Meta error", httpStatus, metaError);
      return { ok: false, error: metaError };
    }
    return { ok: true, message_id: metaMessageId, meta: metaJson };
  });

// Legacy helper kept for compatibility with any existing callers.
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { whatsapp_account_id: string; to: string; text: string }) =>
    z.object({
      whatsapp_account_id: z.string().uuid(),
      to: z.string().trim().min(5).max(30),
      text: z.string().trim().min(1).max(4096),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acct } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("phone_number_id, token_encrypted")
      .eq("id", data.whatsapp_account_id)
      .maybeSingle();
    if (!acct?.phone_number_id || !acct?.token_encrypted) throw new Error("Cuenta sin credenciales");
    const version = process.env.META_GRAPH_API_VERSION ?? "v25.0";
    const to = data.to.replace(/[^\d]/g, "");
    const res = await fetch(`https://graph.facebook.com/${version}/${acct.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${acct.token_encrypted}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: data.text },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? "Fallo al enviar mensaje");
    return { ok: true, message_id: json?.messages?.[0]?.id ?? null };
  });
