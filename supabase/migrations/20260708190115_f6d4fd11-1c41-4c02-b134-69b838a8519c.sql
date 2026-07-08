
CREATE TABLE public.test_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_contacts TO authenticated;
GRANT ALL ON public.test_contacts TO service_role;
ALTER TABLE public.test_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage test contacts" ON public.test_contacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE INDEX idx_test_contacts_client ON public.test_contacts(client_id, created_at DESC);
