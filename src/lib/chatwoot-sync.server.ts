// Server-only helper. Never import from client-reachable modules at top level.
// Use dynamic `await import(...)` inside route/server-fn handlers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ChatwootConfig = {
  client_id: string;
  base_url: string;
  account_id: string;
  inbox_id: string;
  api_token: string;
  pause_label: string;
  pause_on_assigned: boolean;
};

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function loadChatwootConfig(clientId: string): Promise<ChatwootConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("client_integrations")
    .select(
      "chatwoot_enabled, chatwoot_base_url, chatwoot_account_id, chatwoot_inbox_id, chatwoot_api_access_token_encrypted, chatwoot_bot_pause_label, pause_on_assigned",
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.chatwoot_enabled) return null;
  if (
    !data.chatwoot_base_url ||
    !data.chatwoot_account_id ||
    !data.chatwoot_inbox_id ||
    !data.chatwoot_api_access_token_encrypted
  ) {
    return null;
  }
  return {
    client_id: clientId,
    base_url: normalizeBaseUrl(data.chatwoot_base_url),
    account_id: data.chatwoot_account_id,
    inbox_id: data.chatwoot_inbox_id,
    api_token: data.chatwoot_api_access_token_encrypted,
    pause_label: data.chatwoot_bot_pause_label ?? "human",
    pause_on_assigned: !!data.pause_on_assigned,
  };
}

async function cwFetch(
  cfg: ChatwootConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  const url = `${cfg.base_url}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      api_access_token: cfg.api_token,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function logCw(
  clientId: string,
  event_type: string,
  direction: "incoming" | "outgoing" | null,
  status: "success" | "error" | "ignored",
  extras: Record<string, any> = {},
) {
  try {
    await supabaseAdmin.from("chatwoot_integration_logs").insert({
      client_id: clientId,
      event_type,
      direction,
      status,
      ...extras,
    } as any);
  } catch (err) {
    console.error("[chatwoot-sync] log insert failed", err);
  }
}

async function ensureContact(
  cfg: ChatwootConfig,
  waId: string,
  profileName: string | null,
): Promise<string | null> {
  // Try local mapping first.
  const existing = await supabaseAdmin
    .from("chatwoot_contact_mappings")
    .select("chatwoot_contact_id")
    .eq("client_id", cfg.client_id)
    .eq("wa_id", waId)
    .maybeSingle();
  if (existing.data?.chatwoot_contact_id) return existing.data.chatwoot_contact_id;

  // Search by identifier in Chatwoot.
  const search = await cwFetch(
    cfg,
    `/api/v1/accounts/${cfg.account_id}/contacts/search?q=${encodeURIComponent(waId)}&include=contact_inboxes`,
  );
  let contactId: string | null = null;
  if (search.ok) {
    const payload = search.body?.payload;
    const rows: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const match = rows.find(
      (c) => c?.identifier === waId || c?.phone_number === `+${waId}` || c?.phone_number === waId,
    );
    if (match?.id) contactId = String(match.id);
  }

  if (!contactId) {
    const create = await cwFetch(cfg, `/api/v1/accounts/${cfg.account_id}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        inbox_id: Number(cfg.inbox_id) || cfg.inbox_id,
        name: profileName || waId,
        identifier: waId,
        phone_number: `+${waId}`,
      }),
    });
    if (create.ok && create.body?.payload?.contact?.id) {
      contactId = String(create.body.payload.contact.id);
    } else if (create.body?.payload?.contact?.id) {
      contactId = String(create.body.payload.contact.id);
    } else {
      await logCw(cfg.client_id, "contact_create_failed", "outgoing", "error", {
        wa_id: waId,
        http_status: create.status,
        error_message: JSON.stringify(create.body).slice(0, 500),
      });
      return null;
    }
  }

  await supabaseAdmin
    .from("chatwoot_contact_mappings")
    .upsert(
      {
        client_id: cfg.client_id,
        wa_id: waId,
        phone: `+${waId}`,
        profile_name: profileName,
        chatwoot_contact_id: contactId,
      } as any,
      { onConflict: "client_id,wa_id" },
    );
  return contactId;
}

async function ensureConversation(
  cfg: ChatwootConfig,
  waId: string,
  contactId: string,
): Promise<string | null> {
  const existing = await supabaseAdmin
    .from("chatwoot_conversation_mappings")
    .select("chatwoot_conversation_id, status")
    .eq("client_id", cfg.client_id)
    .eq("wa_id", waId)
    .maybeSingle();

  if (existing.data?.chatwoot_conversation_id) {
    // If closed/resolved, we still reuse; Chatwoot reopens on new incoming message.
    return existing.data.chatwoot_conversation_id;
  }

  // Try to find an existing conversation in Chatwoot for this contact + inbox.
  const list = await cwFetch(
    cfg,
    `/api/v1/accounts/${cfg.account_id}/contacts/${contactId}/conversations`,
  );
  let convId: string | null = null;
  if (list.ok) {
    const rows: any[] = list.body?.payload ?? [];
    const match = rows.find((c) => String(c?.inbox_id) === String(cfg.inbox_id));
    if (match?.id) convId = String(match.id);
  }

  if (!convId) {
    const create = await cwFetch(cfg, `/api/v1/accounts/${cfg.account_id}/conversations`, {
      method: "POST",
      body: JSON.stringify({
        source_id: waId,
        inbox_id: Number(cfg.inbox_id) || cfg.inbox_id,
        contact_id: Number(contactId) || contactId,
      }),
    });
    if (create.ok && create.body?.id) {
      convId = String(create.body.id);
    } else {
      await logCw(cfg.client_id, "conversation_create_failed", "outgoing", "error", {
        wa_id: waId,
        chatwoot_contact_id: contactId,
        http_status: create.status,
        error_message: JSON.stringify(create.body).slice(0, 500),
      });
      return null;
    }
  }

  await supabaseAdmin
    .from("chatwoot_conversation_mappings")
    .upsert(
      {
        client_id: cfg.client_id,
        wa_id: waId,
        chatwoot_contact_id: contactId,
        chatwoot_conversation_id: convId,
      } as any,
      { onConflict: "client_id,wa_id" },
    );
  return convId;
}

async function postIncomingMessage(
  cfg: ChatwootConfig,
  convId: string,
  waMessageId: string | null,
  text: string | null,
  messageType: string | null,
): Promise<{ ok: boolean; chatwoot_message_id: string | null; status: number; body: any }> {
  const payload: Record<string, any> = {
    content: text ?? `[${messageType ?? "message"}]`,
    message_type: "incoming",
    content_attributes: {
      source: "meta",
      wa_message_id: waMessageId,
      wa_message_type: messageType,
    },
  };
  if (waMessageId) payload.source_id = `wa:${waMessageId}`;
  const res = await cwFetch(
    cfg,
    `/api/v1/accounts/${cfg.account_id}/conversations/${convId}/messages`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return {
    ok: res.ok,
    status: res.status,
    body: res.body,
    chatwoot_message_id: res.body?.id ? String(res.body.id) : null,
  };
}

async function refreshConversationState(
  cfg: ChatwootConfig,
  convId: string,
  waId: string,
): Promise<{ labels: string[]; assignee_id: string | null; status: string | null }> {
  const [conv, labels] = await Promise.all([
    cwFetch(cfg, `/api/v1/accounts/${cfg.account_id}/conversations/${convId}`),
    cwFetch(cfg, `/api/v1/accounts/${cfg.account_id}/conversations/${convId}/labels`),
  ]);
  const labelList: string[] = Array.isArray(labels.body?.payload) ? labels.body.payload : [];
  const assigneeId = conv.body?.meta?.assignee?.id
    ? String(conv.body.meta.assignee.id)
    : conv.body?.assignee_id
    ? String(conv.body.assignee_id)
    : null;
  const status: string | null = conv.body?.status ?? null;

  const bot_paused =
    labelList.includes(cfg.pause_label) || (cfg.pause_on_assigned && !!assigneeId);

  await supabaseAdmin
    .from("chatwoot_conversation_mappings")
    .update({
      status,
      labels: labelList as any,
      assignee_id: assigneeId,
      bot_paused,
    } as any)
    .eq("client_id", cfg.client_id)
    .eq("wa_id", waId);

  return { labels: labelList, assignee_id: assigneeId, status };
}

export type ChatwootSyncResult =
  | { synced: false; reason: string }
  | {
      synced: true;
      bot_paused: boolean;
      chatwoot_conversation_id: string;
      chatwoot_message_id: string | null;
      labels: string[];
      assignee_id: string | null;
    };

// Main entry point: sync one inbound WhatsApp message to Chatwoot.
// Never throws — errors are logged and returned as { synced: false }.
export async function syncInboundToChatwoot(params: {
  client_id: string;
  wa_id: string;
  profile_name: string | null;
  wa_message_id: string | null;
  message_type: string | null;
  text: string | null;
}): Promise<ChatwootSyncResult> {
  try {
    const cfg = await loadChatwootConfig(params.client_id);
    if (!cfg) return { synced: false, reason: "chatwoot_disabled_or_unconfigured" };

    // Anti-loop: if this wa_message_id was already mirrored, skip re-posting.
    if (params.wa_message_id) {
      const dup = await supabaseAdmin
        .from("chatwoot_message_mappings")
        .select("chatwoot_message_id, chatwoot_conversation_id")
        .eq("client_id", cfg.client_id)
        .eq("inbound_message_id", params.wa_message_id)
        .maybeSingle();
      if (dup.data?.chatwoot_conversation_id) {
        const state = await refreshConversationState(cfg, dup.data.chatwoot_conversation_id, params.wa_id);
        return {
          synced: true,
          bot_paused:
            state.labels.includes(cfg.pause_label) ||
            (cfg.pause_on_assigned && !!state.assignee_id),
          chatwoot_conversation_id: dup.data.chatwoot_conversation_id,
          chatwoot_message_id: dup.data.chatwoot_message_id ?? null,
          labels: state.labels,
          assignee_id: state.assignee_id,
        };
      }
    }

    const contactId = await ensureContact(cfg, params.wa_id, params.profile_name);
    if (!contactId) return { synced: false, reason: "contact_unavailable" };

    const convId = await ensureConversation(cfg, params.wa_id, contactId);
    if (!convId) return { synced: false, reason: "conversation_unavailable" };

    const msg = await postIncomingMessage(
      cfg,
      convId,
      params.wa_message_id,
      params.text,
      params.message_type,
    );

    await supabaseAdmin.from("chatwoot_message_mappings").insert({
      client_id: cfg.client_id,
      wa_id: params.wa_id,
      inbound_message_id: params.wa_message_id,
      chatwoot_message_id: msg.chatwoot_message_id,
      chatwoot_conversation_id: convId,
      direction: "incoming",
      source: "meta",
    } as any);

    await logCw(cfg.client_id, "inbound_synced", "incoming", msg.ok ? "success" : "error", {
      wa_id: params.wa_id,
      chatwoot_contact_id: contactId,
      chatwoot_conversation_id: convId,
      chatwoot_message_id: msg.chatwoot_message_id,
      wa_message_id: params.wa_message_id,
      http_status: msg.status,
      error_message: msg.ok ? null : JSON.stringify(msg.body).slice(0, 500),
    });

    const state = await refreshConversationState(cfg, convId, params.wa_id);
    const bot_paused =
      state.labels.includes(cfg.pause_label) ||
      (cfg.pause_on_assigned && !!state.assignee_id);

    await supabaseAdmin
      .from("client_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("client_id", cfg.client_id);

    return {
      synced: true,
      bot_paused,
      chatwoot_conversation_id: convId,
      chatwoot_message_id: msg.chatwoot_message_id,
      labels: state.labels,
      assignee_id: state.assignee_id,
    };
  } catch (err: any) {
    console.error("[chatwoot-sync] error", err);
    await logCw(params.client_id, "inbound_sync_error", "incoming", "error", {
      wa_id: params.wa_id,
      wa_message_id: params.wa_message_id,
      error_message: String(err?.message ?? err).slice(0, 500),
    });
    return { synced: false, reason: "exception" };
  }
}
