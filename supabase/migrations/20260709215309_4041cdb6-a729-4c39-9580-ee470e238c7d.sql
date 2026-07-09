
ALTER TABLE public.client_integrations
  ADD COLUMN IF NOT EXISTS chatwoot_unhealthy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatwoot_unhealthy_reason TEXT,
  ADD COLUMN IF NOT EXISTS chatwoot_unhealthy_since TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chatwoot_integration_logs_client_created_idx
  ON public.chatwoot_integration_logs (client_id, created_at DESC);
