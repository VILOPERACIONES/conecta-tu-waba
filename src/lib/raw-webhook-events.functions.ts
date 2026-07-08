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

// Lista los últimos payloads crudos recibidos desde Meta en el webhook
// público. Incluye eventos sin phone_number_id (por ej. el botón Test de
// Meta Developers).
export const listRawWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; phone_number_id?: string | null }) =>
    z.object({
      limit: z.number().int().min(1).max(500).optional(),
      phone_number_id: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("raw_meta_webhook_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.phone_number_id) q = q.eq("phone_number_id", data.phone_number_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
