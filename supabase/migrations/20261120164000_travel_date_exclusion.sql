-- Calendar intervals use UTC midnight through 23:59:59, inclusive for travel dates.
-- GiST exclusion rejects overlapping trips even across concurrent requests.
set local search_path = public, extensions, pg_catalog;
do $$
begin
 if not exists (select 1 from pg_constraint where conrelid='public.ccx_travel_dates'::regclass and conname='ccx_travel_dates_no_overlap') then
  alter table public.ccx_travel_dates
   add constraint ccx_travel_dates_no_overlap
   exclude using gist (user_id with =, tstzrange(starts_at,ends_at,'[]') with &&)
   deferrable initially immediate;
 end if;
end $$;