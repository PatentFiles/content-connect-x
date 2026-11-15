-- Consent is separate from subscription, payment, and contract signatures.
-- Every performer grants scope for themself; revocations remain available even
-- when membership expires. This is an operational audit trail, not legal advice.

create table if not exists public.collaboration_consents (
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participation_consent boolean not null default false,
  recording_consent boolean not null default false,
  distribution_consent boolean not null default false,
  download_consent boolean not null default false,
  recorded_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(collaboration_id,user_id),
  constraint participation_before_recording check (not recording_consent or participation_consent)
);

create table if not exists public.collaboration_consent_events (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  action text not null check(action in ('granted','revoked')),
  scope_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.collaboration_consents enable row level security;
alter table public.collaboration_consent_events enable row level security;

create policy "member views own consent" on public.collaboration_consents
  for select to authenticated using (user_id=(select auth.uid()));
create policy "member views own consent events" on public.collaboration_consent_events
  for select to authenticated using (user_id=(select auth.uid()));

-- Contract content and title may not be changed once any party signs.
create or replace function public.enforce_contract_immutable_after_signature()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.contract_signatures s where s.contract_id=old.id) then
    if tg_op='DELETE' then
      raise exception 'Signed contract cannot be deleted by normal operations';
    end if;
    if new.content is distinct from old.content
       or new.title is distinct from old.title
       or new.collaboration_id is distinct from old.collaboration_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Signed contract terms cannot be changed';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
drop trigger if exists contracts_lock_signed_terms on public.contracts;
create trigger contracts_lock_signed_terms before update or delete on public.contracts
for each row execute function public.enforce_contract_immutable_after_signature();

-- Signature and consent event history cannot be silently altered by ordinary writes.
create or replace function public.prevent_event_modification()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Signed and consent event history is immutable';
end;
$$;
drop trigger if exists protect_contract_signatures on public.contract_signatures;
create trigger protect_contract_signatures before update or delete on public.contract_signatures
for each row execute function public.prevent_event_modification();
drop trigger if exists protect_consent_events on public.collaboration_consent_events;
create trigger protect_consent_events before update or delete on public.collaboration_consent_events
for each row execute function public.prevent_event_modification();
