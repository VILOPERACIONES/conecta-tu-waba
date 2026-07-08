
CREATE POLICY "Admins update webhook_events" ON public.webhook_events
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete webhook_events" ON public.webhook_events
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
