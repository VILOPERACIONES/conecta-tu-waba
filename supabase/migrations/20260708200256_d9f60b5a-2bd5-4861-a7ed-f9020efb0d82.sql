
ALTER TABLE public.message_send_logs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'panel',
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS request_payload jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_send_logs;
ALTER TABLE public.message_send_logs REPLICA IDENTITY FULL;
