-- Supabase security advisory: keep btree_gist outside exposed public schema.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
