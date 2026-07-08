import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Sends a WhatsApp text message via Meta Graph API.
// Admin-only. The client's access token stays on the server; never returned to browser.
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
    // admin check
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acct, error } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("phone_number_id, token_encrypted, status")
      .eq("id", data.whatsapp_account_id)
      .maybeSingle();
    if (error || !acct) throw new Error("Cuenta no encontrada");
    if (!acct.phone_number_id || !acct.token_encrypted) throw new Error("Cuenta sin credenciales");

    const version = process.env.META_GRAPH_API_VERSION ?? "v21.0";
    const url = `https://graph.facebook.com/${version}/${acct.phone_number_id}/messages`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acct.token_encrypted}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: data.to,
          type: "text",
          text: { body: data.text },
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[send-whatsapp] Meta error", json);
        throw new Error(json?.error?.message ?? "Fallo al enviar mensaje");
      }
      return { ok: true, message_id: json?.messages?.[0]?.id ?? null };
    } catch (err: any) {
      console.error("[send-whatsapp] fetch error", err);
      throw new Error(err.message ?? "Error de red");
    }
  });
