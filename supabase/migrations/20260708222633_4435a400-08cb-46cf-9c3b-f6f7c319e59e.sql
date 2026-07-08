ALTER TABLE public.n8n_forward_logs ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.n8n_forward_logs ALTER COLUMN n8n_webhook_url DROP NOT NULL;