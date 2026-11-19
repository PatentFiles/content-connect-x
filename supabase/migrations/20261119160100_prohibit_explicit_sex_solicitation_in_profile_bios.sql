-- Server-enforced platform rule on professional marketplace biographies.
-- Blocks clear offers to trade sexual services for money, not discussions of
-- legality, safety, trafficking reports, or professional production rates.
-- A human moderation queue remains necessary for euphemisms and disputes.
create or replace function public.ccx_bio_solicits_sex_services(p_bio text)
returns boolean language sql immutable set search_path = '' as $$
 select coalesce(p_bio,'') ~* '(^|[^[:alnum:]])((sex(ual)? (acts?|services?|intercourse) (for|in exchange for) (money|cash|payment|fees?|donations?))|(pay(ment)?|cash|money|donation|fee) (me )?(for|to have) (sex|sexual services|intercourse)|(book|hire) me (for )?(escort(ing)?|sex(ual services)?)|(escort(ing)?|prostitut(ion|ion services)?) (bookings?|appointments?|services?|rates?))([^[:alnum:]]|$)'
$$;
create or replace function public.ccx_reject_solicitation_bio()
returns trigger language plpgsql set search_path = '' as $$
begin
 if public.ccx_bio_solicits_sex_services(new.bio) then
  raise exception using errcode='23514',
    message='Profiles may describe legal content creation and professional collaboration, but cannot advertise or arrange paid sexual services. Please remove the solicitation before saving.';
 end if;
 return new;
end;
$$;
drop trigger if exists ccx_reject_solicitation_bio on public.member_profiles;
create trigger ccx_reject_solicitation_bio
 before insert or update of bio on public.member_profiles
 for each row execute function public.ccx_reject_solicitation_bio();
revoke all on function public.ccx_reject_solicitation_bio() from public, anon, authenticated;
comment on function public.ccx_bio_solicits_sex_services(text) is 'Deterministic narrow marketplace bio screening, not full behavioral moderation.';
