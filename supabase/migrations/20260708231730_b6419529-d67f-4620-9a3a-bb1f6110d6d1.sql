CREATE TABLE IF NOT EXISTS public.processed_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  phone_number_id text,
  message_id text NOT NULL UNIQUE,
  from_wa_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_wa_messages_message_id ON public.processed_whatsapp_messages(message_id);

GRANT SELECT ON public.processed_whatsapp_messages TO authenticated;
GRANT ALL ON public.processed_whatsapp_messages TO service_role;

ALTER TABLE public.processed_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view processed messages"
  ON public.processed_whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
