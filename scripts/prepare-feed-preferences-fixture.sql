-- Only for the synthetic PostgreSQL CI fixture; production Supabase
-- already provides auth.uid() and must never execute this fixture.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'ccx_feed_test' THEN RAISE EXCEPTION 'Disposable only'; END IF; END $$;
create or replace function auth.uid() returns uuid language sql stable
 as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
