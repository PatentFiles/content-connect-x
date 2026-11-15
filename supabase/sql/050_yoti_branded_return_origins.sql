-- Admin-controlled Yoti redirect hostnames. These are public URLs, not secrets.
-- The API validates them and never trusts unverified browser redirect parameters.
ALTER TABLE public.ccx_integrations
 ADD COLUMN IF NOT EXISTS callback_origin text,
 ADD COLUMN IF NOT EXISTS secondary_origin text;
