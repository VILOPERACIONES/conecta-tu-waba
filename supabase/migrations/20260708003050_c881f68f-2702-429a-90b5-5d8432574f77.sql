
-- Move has_role to a private schema so it is not exposed via the Data API,
-- and revoke public/anon/authenticated EXECUTE on the public copy.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Rewrite existing policies to use private.has_role, then drop the public one.
-- clients
DROP POLICY IF EXISTS "Admins manage clients" ON public.clients;
CREATE POLICY "Admins manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- onboarding_links
DROP POLICY IF EXISTS "Admins manage onboarding_links" ON public.onboarding_links;
CREATE POLICY "Admins manage onboarding_links" ON public.onboarding_links
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- webhook_events
DROP POLICY IF EXISTS "Admins read webhook_events" ON public.webhook_events;
CREATE POLICY "Admins read webhook_events" ON public.webhook_events
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert webhook_events" ON public.webhook_events
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- whatsapp_accounts
DROP POLICY IF EXISTS "Admins read whatsapp_accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Admins update whatsapp_accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Admins delete whatsapp_accounts" ON public.whatsapp_accounts;

CREATE POLICY "Admins read whatsapp_accounts" ON public.whatsapp_accounts
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update whatsapp_accounts" ON public.whatsapp_accounts
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete whatsapp_accounts" ON public.whatsapp_accounts
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert whatsapp_accounts" ON public.whatsapp_accounts
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- user_roles: admin management policies (INSERT/UPDATE/DELETE)
CREATE POLICY "Admins insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Drop the public has_role now that no policies reference it.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
