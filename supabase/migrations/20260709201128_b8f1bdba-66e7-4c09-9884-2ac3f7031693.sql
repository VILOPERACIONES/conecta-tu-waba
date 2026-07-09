
CREATE TABLE public.client_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  chatwoot_enabled BOOLEAN NOT NULL DEFAULT false,
  chatwoot_base_url TEXT,
  chatwoot_account_id TEXT,
  chatwoot_inbox_id TEXT,
  chatwoot_api_access_token_encrypted TEXT,
  chatwoot_webhook_secret_encrypted TEXT,
  chatwoot_bot_pause_label TEXT NOT NULL DEFAULT 'human',
  chatwoot_bot_active_label TEXT NOT NULL DEFAULT 'bot_on',
  pause_on_assigned BOOLEAN NOT NULL DEFAULT false,
  last_test_status TEXT,
  last_test_error TEXT,
  last_test_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_integrations_client_unique UNIQUE (client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_integrations TO authenticated;
GRANT ALL ON public.client_integrations TO service_role;
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_integrations" ON public.client_integrations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_client_integrations_updated_at BEFORE UPDATE ON public.client_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chatwoot_contact_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  wa_id TEXT NOT NULL,
  phone TEXT,
  profile_name TEXT,
  chatwoot_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chatwoot_contact_mappings_unique UNIQUE (client_id, wa_id)
);
CREATE INDEX idx_chatwoot_contact_mappings_client ON public.chatwoot_contact_mappings(client_id);
CREATE INDEX idx_chatwoot_contact_mappings_cw_contact ON public.chatwoot_contact_mappings(client_id, chatwoot_contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatwoot_contact_mappings TO authenticated;
GRANT ALL ON public.chatwoot_contact_mappings TO service_role;
ALTER TABLE public.chatwoot_contact_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage chatwoot_contact_mappings" ON public.chatwoot_contact_mappings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_chatwoot_contact_mappings_updated_at BEFORE UPDATE ON public.chatwoot_contact_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chatwoot_conversation_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  wa_id TEXT NOT NULL,
  chatwoot_contact_id TEXT,
  chatwoot_conversation_id TEXT NOT NULL,
  status TEXT,
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignee_id TEXT,
  bot_paused BOOLEAN NOT NULL DEFAULT false,
  last_inbound_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chatwoot_conversation_mappings_unique UNIQUE (client_id, wa_id)
);
CREATE INDEX idx_chatwoot_conv_mappings_client ON public.chatwoot_conversation_mappings(client_id);
CREATE INDEX idx_chatwoot_conv_mappings_cw_conv ON public.chatwoot_conversation_mappings(client_id, chatwoot_conversation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatwoot_conversation_mappings TO authenticated;
GRANT ALL ON public.chatwoot_conversation_mappings TO service_role;
ALTER TABLE public.chatwoot_conversation_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage chatwoot_conversation_mappings" ON public.chatwoot_conversation_mappings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_chatwoot_conv_mappings_updated_at BEFORE UPDATE ON public.chatwoot_conversation_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chatwoot_message_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  wa_id TEXT,
  inbound_message_id TEXT,
  outbound_message_id TEXT,
  chatwoot_message_id TEXT,
  chatwoot_conversation_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  source TEXT NOT NULL CHECK (source IN ('meta','n8n','chatwoot_agent','system','backend')),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_chatwoot_msg_map_cw_msg_unique ON public.chatwoot_message_mappings(client_id, chatwoot_message_id) WHERE chatwoot_message_id IS NOT NULL;
CREATE UNIQUE INDEX idx_chatwoot_msg_map_inbound_unique ON public.chatwoot_message_mappings(client_id, inbound_message_id) WHERE inbound_message_id IS NOT NULL;
CREATE UNIQUE INDEX idx_chatwoot_msg_map_outbound_unique ON public.chatwoot_message_mappings(client_id, outbound_message_id) WHERE outbound_message_id IS NOT NULL;
CREATE UNIQUE INDEX idx_chatwoot_msg_map_idem_unique ON public.chatwoot_message_mappings(client_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_chatwoot_msg_map_client_wa ON public.chatwoot_message_mappings(client_id, wa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatwoot_message_mappings TO authenticated;
GRANT ALL ON public.chatwoot_message_mappings TO service_role;
ALTER TABLE public.chatwoot_message_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage chatwoot_message_mappings" ON public.chatwoot_message_mappings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.chatwoot_integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  direction TEXT,
  wa_id TEXT,
  chatwoot_contact_id TEXT,
  chatwoot_conversation_id TEXT,
  chatwoot_message_id TEXT,
  status TEXT,
  http_status INT,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chatwoot_logs_client_created ON public.chatwoot_integration_logs(client_id, created_at DESC);
CREATE INDEX idx_chatwoot_logs_event_type ON public.chatwoot_integration_logs(event_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatwoot_integration_logs TO authenticated;
GRANT ALL ON public.chatwoot_integration_logs TO service_role;
ALTER TABLE public.chatwoot_integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chatwoot_integration_logs" ON public.chatwoot_integration_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert chatwoot_integration_logs" ON public.chatwoot_integration_logs FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
