
CREATE TABLE public.raw_meta_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  method text,
  url text,
  query_params jsonb,
  headers jsonb,
  body_raw text,
  body_json jsonb,
  phone_number_id text,
  object_type text,
  is_meta_test boolean NOT NULL DEFAULT false,
  processing_error text,
  processed boolean NOT NULL DEFAULT false
);

GRANT SELECT ON public.raw_meta_webhook_events TO authenticated;
GRANT ALL ON public.raw_meta_webhook_events TO service_role;

ALTER TABLE public.raw_meta_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view raw_meta_webhook_events"
  ON public.raw_meta_webhook_events FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_rmwe_received_at ON public.raw_meta_webhook_events(received_at DESC);
CREATE INDEX idx_rmwe_phone_number_id ON public.raw_meta_webhook_events(phone_number_id);
