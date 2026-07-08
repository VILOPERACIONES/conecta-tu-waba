ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS n8n_last_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS n8n_last_delivery_status text,
  ADD COLUMN IF NOT EXISTS n8n_last_delivery_error text;