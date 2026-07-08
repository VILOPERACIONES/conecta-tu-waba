
-- meta_webhook_events
CREATE TABLE public.meta_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  whatsapp_account_id uuid NULL REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  phone_number_id text NULL,
  direction text NOT NULL DEFAULT 'inbound_from_meta',
  field text NULL,
  event_kind text NULL,
  wa_message_id text NULL,
  from_wa_id text NULL,
  to_phone_number text NULL,
  message_type text NULL,
  text_body text NULL,
  status text NULL,
  error_code text NULL,
  error_title text NULL,
  error_message text NULL,
  error_details jsonb NULL,
  raw_headers jsonb NULL,
  raw_payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  processing_error text NULL
);
GRANT SELECT ON public.meta_webhook_events TO authenticated;
GRANT ALL ON public.meta_webhook_events TO service_role;
ALTER TABLE public.meta_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view meta_webhook_events" ON public.meta_webhook_events
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mwe_client_received ON public.meta_webhook_events(client_id, received_at DESC);
CREATE INDEX idx_mwe_wa_message_id ON public.meta_webhook_events(wa_message_id);

-- n8n_forward_logs
CREATE TABLE public.n8n_forward_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  meta_webhook_event_id uuid NULL REFERENCES public.meta_webhook_events(id) ON DELETE SET NULL,
  phone_number_id text NULL,
  n8n_webhook_url text NOT NULL,
  request_headers jsonb NULL,
  request_payload jsonb NULL,
  response_status integer NULL,
  response_body text NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.n8n_forward_logs TO authenticated;
GRANT ALL ON public.n8n_forward_logs TO service_role;
ALTER TABLE public.n8n_forward_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view n8n_forward_logs" ON public.n8n_forward_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_nfl_client_attempted ON public.n8n_forward_logs(client_id, attempted_at DESC);

-- whatsapp_send_logs
CREATE TABLE public.whatsapp_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NULL REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  phone_number_id text NULL,
  to_wa_id text NULL,
  message_type text NULL,
  message_preview text NULL,
  request_payload jsonb NULL,
  response_status integer NULL,
  response_body jsonb NULL,
  meta_message_id text NULL,
  meta_message_status text NULL,
  success boolean NOT NULL DEFAULT false,
  error_code text NULL,
  error_subcode text NULL,
  error_type text NULL,
  error_message text NULL,
  fbtrace_id text NULL,
  source text NOT NULL DEFAULT 'panel',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_send_logs TO authenticated;
GRANT ALL ON public.whatsapp_send_logs TO service_role;
ALTER TABLE public.whatsapp_send_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view whatsapp_send_logs" ON public.whatsapp_send_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_wsl_client_created ON public.whatsapp_send_logs(client_id, created_at DESC);
CREATE INDEX idx_wsl_meta_message_id ON public.whatsapp_send_logs(meta_message_id);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_webhook_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.n8n_forward_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_send_logs;
