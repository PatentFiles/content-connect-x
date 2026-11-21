-- A private audio-transcription queue; payload contains a recording UUID only.
select pgmq.create('ccx_audio_transcripts');

create table if not exists public.ccx_transcription_delivery (
 recording_id uuid primary key references public.ccx_meeting_recordings(id) on delete cascade,
 queue_msg_id bigint not null unique,
 status text not null default 'pending'
   check(status in('pending','retry','completed','skipped','failed')),
 attempts integer not null default 0 check(attempts between 0 and 30),
 last_error text,created_at timestamptz not null default now(),completed_at timestamptz
);
create index if not exists ccx_transcription_delivery_status_idx
 on public.ccx_transcription_delivery(status,created_at);
alter table public.ccx_transcription_delivery enable row level security;
revoke all on public.ccx_transcription_delivery from PUBLIC,anon,authenticated;

create or replace function ccx_workspace_private.ccx_queue_audio_transcript()
returns trigger language plpgsql security definer set search_path='' as $body$
declare job_id bigint;
begin
 if new.content_type in('audio/webm','audio/mp4') and new.transcript_status='pending' then
  select pgmq.send('ccx_audio_transcripts',jsonb_build_object('recording_id',new.id::text))
  into job_id;
  insert into public.ccx_transcription_delivery(recording_id,queue_msg_id)
  values(new.id,job_id) on conflict(recording_id) do nothing;
 end if;
 return new;
end $body$;
drop trigger if exists ccx_audio_transcription_enqueue on public.ccx_meeting_recordings;
create trigger ccx_audio_transcription_enqueue after insert on public.ccx_meeting_recordings
for each row execute function ccx_workspace_private.ccx_queue_audio_transcript();
revoke all on function ccx_workspace_private.ccx_queue_audio_transcript() from PUBLIC,anon,authenticated;

create or replace function public.ccx_transcription_claim(p_limit integer default 3)
returns jsonb language sql security definer set search_path='' as $body$
 select coalesce(jsonb_agg(jsonb_build_object(
  'msg_id',m.msg_id,'read_ct',m.read_ct,'recording_id',m.message->>'recording_id'
 )),'[]'::jsonb)
 from pgmq.read('ccx_audio_transcripts',240,least(3,greatest(1,coalesce(p_limit,3)))) m;
$body$;
revoke all on function public.ccx_transcription_claim(integer) from PUBLIC,anon,authenticated;
grant execute on function public.ccx_transcription_claim(integer) to service_role;

create or replace function public.ccx_transcription_finish(
 p_recording_id uuid,p_msg_id bigint,p_outcome text,p_reason text default null,
 p_retry_seconds integer default 240
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare item public.ccx_transcription_delivery%rowtype;
declare next_attempt integer;
declare final_status text;
begin
 if p_outcome not in('completed','skipped','retry','failed') then
  raise exception 'Invalid transcription outcome' using errcode='22023';
 end if;
 select * into item from public.ccx_transcription_delivery
 where recording_id=p_recording_id and queue_msg_id=p_msg_id for update;
 if not found then raise exception 'Unknown transcription job' using errcode='42501'; end if;
 if item.status in('completed','skipped','failed') then
  perform pgmq.archive('ccx_audio_transcripts',p_msg_id);
  return jsonb_build_object('status',item.status,'attempts',item.attempts);
 end if;
 next_attempt:=item.attempts+1;
 final_status:=case when p_outcome='retry' and next_attempt>=8 then 'failed'
  when p_outcome='retry' then 'retry' else p_outcome end;
 update public.ccx_transcription_delivery
 set status=final_status,attempts=next_attempt,
  last_error=case when final_status in('retry','failed') then left(coalesce(p_reason,'Unavailable'),180) else null end,
  completed_at=case when final_status='retry' then null else now() end
 where recording_id=p_recording_id;
 if final_status='retry' then
  perform pgmq.set_vt('ccx_audio_transcripts',p_msg_id,
   least(21600,greatest(90,coalesce(p_retry_seconds,240))));
 else
  update public.ccx_meeting_recordings
  set transcript_status=case final_status
   when 'completed' then 'completed' when 'skipped' then 'not_requested' else 'failed' end
  where id=p_recording_id and transcript_status<>'completed';
  perform pgmq.archive('ccx_audio_transcripts',p_msg_id);
 end if;
 return jsonb_build_object('status',final_status,'attempts',next_attempt);
end $body$;
revoke all on function public.ccx_transcription_finish(uuid,bigint,text,text,integer) from PUBLIC,anon,authenticated;
grant execute on function public.ccx_transcription_finish(uuid,bigint,text,text,integer) to service_role;
