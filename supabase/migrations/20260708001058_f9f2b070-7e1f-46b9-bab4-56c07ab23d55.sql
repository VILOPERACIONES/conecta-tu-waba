ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS n8n_webhook_url text,
  ADD COLUMN IF NOT EXISTS n8n_webhook_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS n8n_enabled boolean NOT NULL DEFAULT false;