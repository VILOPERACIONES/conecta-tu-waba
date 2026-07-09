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

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// Devuelve la configuración de Chatwoot del cliente (sin exponer secretos en claro).
export const getChatwootConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { client_id: string }) =>
    z.object({ client_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("client_integrations")
      .select(
        "id, client_id, chatwoot_enabled, chatwoot_base_url, chatwoot_account_id, chatwoot_inbox_id, chatwoot_api_access_token_encrypted, chatwoot_webhook_secret_encrypted, chatwoot_webhook_signature_enabled, chatwoot_bot_pause_label, chatwoot_bot_active_label, pause_on_assigned, last_test_status, last_test_error, last_test_at, last_sync_at, updated_at",
      )
      .eq("client_id", data.client_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      return {
        exists: false,
        chatwoot_enabled: false,
        chatwoot_base_url: "",
        chatwoot_account_id: "",
        chatwoot_inbox_id: "",
        has_api_token: false,
        has_webhook_secret: false,
        chatwoot_webhook_signature_enabled: true,
        chatwoot_bot_pause_label: "human",
        chatwoot_bot_active_label: "bot_on",
        pause_on_assigned: false,
        last_test_status: null as string | null,
        last_test_error: null as string | null,
        last_test_at: null as string | null,
        last_sync_at: null as string | null,
      };
    }
    return {
      exists: true,
      chatwoot_enabled: !!row.chatwoot_enabled,
      chatwoot_base_url: row.chatwoot_base_url ?? "",
      chatwoot_account_id: row.chatwoot_account_id ?? "",
      chatwoot_inbox_id: row.chatwoot_inbox_id ?? "",
      has_api_token: !!row.chatwoot_api_access_token_encrypted,
      has_webhook_secret: !!row.chatwoot_webhook_secret_encrypted,
      chatwoot_webhook_signature_enabled: (row as any).chatwoot_webhook_signature_enabled !== false,
      chatwoot_bot_pause_label: row.chatwoot_bot_pause_label ?? "human",
      chatwoot_bot_active_label: row.chatwoot_bot_active_label ?? "bot_on",
      pause_on_assigned: !!row.pause_on_assigned,
      last_test_status: row.last_test_status,
      last_test_error: row.last_test_error,
      last_test_at: row.last_test_at,
      last_sync_at: row.last_sync_at,
    };
  });

export const updateChatwootConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      client_id: string;
      chatwoot_enabled: boolean;
      chatwoot_base_url?: string | null;
      chatwoot_account_id?: string | null;
      chatwoot_inbox_id?: string | null;
      chatwoot_api_token?: string | null;
      chatwoot_webhook_secret?: string | null;
      chatwoot_bot_pause_label?: string;
      chatwoot_bot_active_label?: string;
      pause_on_assigned?: boolean;
    }) =>
      z
        .object({
          client_id: z.string().uuid(),
          chatwoot_enabled: z.boolean(),
          chatwoot_base_url: z
            .string()
            .trim()
            .max(500)
            .url()
            .nullable()
            .optional()
            .or(z.literal("").transform(() => null)),
          chatwoot_account_id: z
            .string()
            .trim()
            .max(100)
            .nullable()
            .optional()
            .or(z.literal("").transform(() => null)),
          chatwoot_inbox_id: z
            .string()
            .trim()
            .max(100)
            .nullable()
            .optional()
            .or(z.literal("").transform(() => null)),
          chatwoot_api_token: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .optional()
            .or(z.literal("").transform(() => null)),
          chatwoot_webhook_secret: z
            .string()
            .trim()
            .max(1000)
            .nullable()
            .optional()
            .or(z.literal("").transform(() => null)),
          chatwoot_bot_pause_label: z.string().trim().min(1).max(100).optional(),
          chatwoot_bot_active_label: z.string().trim().min(1).max(100).optional(),
          pause_on_assigned: z.boolean().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {
      client_id: data.client_id,
      chatwoot_enabled: data.chatwoot_enabled,
      chatwoot_base_url: data.chatwoot_base_url ? normalizeBaseUrl(data.chatwoot_base_url) : null,
      chatwoot_account_id: data.chatwoot_account_id ?? null,
      chatwoot_inbox_id: data.chatwoot_inbox_id ?? null,
      chatwoot_bot_pause_label: data.chatwoot_bot_pause_label ?? "human",
      chatwoot_bot_active_label: data.chatwoot_bot_active_label ?? "bot_on",
      pause_on_assigned: data.pause_on_assigned ?? false,
    };
    // Solo tocar secretos si vienen explícitos.
    if (data.chatwoot_api_token !== undefined) {
      patch.chatwoot_api_access_token_encrypted = data.chatwoot_api_token;
    }
    if (data.chatwoot_webhook_secret !== undefined) {
      patch.chatwoot_webhook_secret_encrypted = data.chatwoot_webhook_secret;
    }

    const { data: existing } = await supabaseAdmin
      .from("client_integrations")
      .select("id")
      .eq("client_id", data.client_id)
      .maybeSingle();

    let error;
    if (existing?.id) {
      const { error: uErr } = await supabaseAdmin
        .from("client_integrations")
        .update(patch as any)
        .eq("id", existing.id);
      error = uErr;
    } else {
      const { error: iErr } = await supabaseAdmin
        .from("client_integrations")
        .insert(patch as any);
      error = iErr;
    }
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Prueba de conexión: llama GET /api/v1/accounts/{account_id}/inboxes/{inbox_id}
// con el api_access_token guardado. No expone el token; solo devuelve ok + detalle.
export const testChatwootConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { client_id: string }) =>
    z.object({ client_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg, error } = await supabaseAdmin
      .from("client_integrations")
      .select(
        "id, chatwoot_base_url, chatwoot_account_id, chatwoot_inbox_id, chatwoot_api_access_token_encrypted",
      )
      .eq("client_id", data.client_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cfg) {
      return { ok: false, error: "Chatwoot no está configurado para este cliente." };
    }
    if (!cfg.chatwoot_base_url || !cfg.chatwoot_account_id || !cfg.chatwoot_api_access_token_encrypted) {
      return { ok: false, error: "Faltan base_url, account_id o api_access_token." };
    }

    const base = normalizeBaseUrl(cfg.chatwoot_base_url);
    const url = cfg.chatwoot_inbox_id
      ? `${base}/api/v1/accounts/${cfg.chatwoot_account_id}/inboxes/${cfg.chatwoot_inbox_id}`
      : `${base}/api/v1/accounts/${cfg.chatwoot_account_id}/inboxes`;

    let httpStatus = 0;
    let body: any = null;
    let ok = false;
    let netErr: string | null = null;
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "content-type": "application/json",
          api_access_token: cfg.chatwoot_api_access_token_encrypted,
        },
      });
      httpStatus = res.status;
      body = await res.json().catch(() => ({}));
      ok = res.ok;
    } catch (err: any) {
      netErr = String(err?.message ?? err).slice(0, 500);
    }

    const now = new Date().toISOString();
    const errMsg = !ok
      ? netErr ?? body?.message ?? body?.error ?? `HTTP ${httpStatus}`
      : null;

    await supabaseAdmin.from("chatwoot_integration_logs").insert({
      client_id: data.client_id,
      event_type: "test_connection",
      direction: "outgoing",
      status: ok ? "success" : "error",
      http_status: httpStatus || null,
      request_payload: { url, method: "GET" },
      response_payload: body ?? (netErr ? { network_error: netErr } : null),
      error_message: errMsg,
    } as any);

    await supabaseAdmin
      .from("client_integrations")
      .update({
        last_test_status: ok ? "success" : "error",
        last_test_error: errMsg,
        last_test_at: now,
      })
      .eq("client_id", data.client_id);

    return ok
      ? { ok: true, http_status: httpStatus, latency_ms: Date.now() - startedAt }
      : { ok: false, error: errMsg, http_status: httpStatus || null };
  });
