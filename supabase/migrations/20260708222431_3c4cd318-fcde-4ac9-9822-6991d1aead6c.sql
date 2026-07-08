ALTER TABLE public.n8n_forward_logs
  ADD COLUMN IF NOT EXISTS forward_attempted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid,
  ADD COLUMN IF NOT EXISTS n8n_enabled_value boolean;