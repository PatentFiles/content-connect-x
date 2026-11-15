-- Intentionally server-mediated inspection records. Explicit deny documentation.
CREATE POLICY no_client_read_turnover_tasks ON public.property_turnover_tasks
 FOR SELECT TO authenticated USING(false);
CREATE POLICY no_client_read_turnover_photos ON public.property_turnover_photos
 FOR SELECT TO authenticated USING(false);