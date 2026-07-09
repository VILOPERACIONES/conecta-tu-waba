
-- Extend processed_whatsapp_messages with dedup tracking columns
ALTER TABLE public.processed_whatsapp_messages
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid,
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS meta_timestamp text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS duplicate_count integer NOT NULL DEFAULT 0;

-- Ensure unique constraint on message_id (may already exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processed_whatsapp_messages_message_id_key'
  ) THEN
    ALTER TABLE public.processed_whatsapp_messages
      ADD CONSTRAINT processed_whatsapp_messages_message_id_key UNIQUE (message_id);
  END IF;
END $$;

-- Add inbound_message_id to whatsapp_send_logs for reply dedup
ALTER TABLE public.whatsapp_send_logs
  ADD COLUMN IF NOT EXISTS inbound_message_id text;

CREATE INDEX IF NOT EXISTS whatsapp_send_logs_inbound_message_id_idx
  ON public.whatsapp_send_logs (inbound_message_id)
  WHERE inbound_message_id IS NOT NULL;
