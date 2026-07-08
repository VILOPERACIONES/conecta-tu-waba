
CREATE TABLE public.message_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  phone_number_id text,
  "to" text NOT NULL,
  message_preview text,
  status text NOT NULL,
  meta_message_id text,
  error_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_send_logs TO authenticated;
GRANT ALL ON public.message_send_logs TO service_role;
ALTER TABLE public.message_send_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view send logs" ON public.message_send_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE INDEX idx_message_send_logs_client ON public.message_send_logs(client_id, created_at DESC);
