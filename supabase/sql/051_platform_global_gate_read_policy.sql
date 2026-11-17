-- Safe read-only exposure of the global testing gate to authenticated clients.
-- Every mutation remains confined to the MFA-protected platform-extras admin API.
DROP POLICY IF EXISTS platform_settings_read_global_gate ON public.platform_settings;
CREATE POLICY platform_settings_read_global_gate ON public.platform_settings
  FOR SELECT TO authenticated USING (key='age_verification_required');
