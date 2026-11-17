-- Supabase Realtime (Cradle-inspired) for already RLS-authorized private messages.
-- postgres_changes honors public.messages SELECT policies, which require membership.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
-- Cursor stays private to each member; updates occur only via member-workflows.
create index if not exists conversation_members_unread
  on public.conversation_members(user_id,conversation_id,last_read_at);
create index if not exists message_sender_rate
  on public.messages(sender_id,created_at desc);