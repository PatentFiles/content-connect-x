-- Host Connect: explicit street-address visibility, default private.
-- No change to booking authorization, private entry instructions, storage or RLS.
-- The service may disclose the address on approved listings ONLY when opted in.
begin;
alter table public.property_private
 add column if not exists public_address_visible boolean not null default false;
comment on column public.property_private.public_address_visible is
 'False by default: exact address visible only through signed paid reservation entry flow. True only on an explicit owner action and only on active approved listings; entry instructions always private.';
commit;
