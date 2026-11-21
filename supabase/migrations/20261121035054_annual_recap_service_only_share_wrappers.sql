-- Expose only service-role invocation names via PostgREST. All decisions
-- remain inside the private, authorization-checking SECURITY DEFINER routines.
create or replace function public.ccx_annual_recap_feed_share(p_recap uuid,p_actor uuid)
returns jsonb language sql security invoker set search_path=''
as $body$ select ccx_workspace_private.ccx_annual_recap_share_feed(p_recap,p_actor) $body$;
create or replace function public.ccx_annual_recap_feed_hide(p_recap uuid,p_actor uuid)
returns jsonb language sql security invoker set search_path=''
as $body$ select ccx_workspace_private.ccx_annual_recap_hide_feed(p_recap,p_actor) $body$;
revoke all on function public.ccx_annual_recap_feed_share(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ccx_annual_recap_feed_hide(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ccx_annual_recap_feed_share(uuid,uuid) to service_role;
grant execute on function public.ccx_annual_recap_feed_hide(uuid,uuid) to service_role;