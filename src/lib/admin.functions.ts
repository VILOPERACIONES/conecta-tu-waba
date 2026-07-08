import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("No autorizado. Se requiere rol admin.");
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("clients")
      .select("id,name,email,company_name,status,created_at,whatsapp_accounts(id,status,display_phone_number,verified_name,waba_id,phone_number_id,webhook_subscribed)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: client, error } = await context.supabase
      .from("clients")
      .select("*, whatsapp_accounts(*), onboarding_links(id,token,expires_at,used_at,created_at)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!client) throw new Error("Cliente no encontrado");
    return client;
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; email?: string; company_name?: string }) =>
    z.object({
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(255).optional().or(z.literal("").transform(() => undefined)),
      company_name: z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined)),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: created, error } = await context.supabase
      .from("clients")
      .insert({ name: data.name, email: data.email ?? null, company_name: data.company_name ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

function makeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { client_id: string; expires_in_hours?: number }) =>
    z.object({
      client_id: z.string().uuid(),
      expires_in_hours: z.number().int().min(1).max(720).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const hours = data.expires_in_hours ?? 72;
    const expires_at = new Date(Date.now() + hours * 3_600_000).toISOString();
    const token = makeToken();
    const { data: link, error } = await context.supabase
      .from("onboarding_links")
      .insert({ client_id: data.client_id, token, expires_at })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return link;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
