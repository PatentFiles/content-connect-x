-- A member notification or recording may be deleted between enqueue and
-- worker claim. Archive the orphaned pointer without delivering anything.
CREATE OR REPLACE FUNCTION public.ccx_email_finish(p_notification_id uuid, p_msg_id bigint, p_outcome text, p_remote_id text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_retry_seconds integer DEFAULT 300)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.ccx_email_delivery%rowtype;
declare attempts_after integer;
declare final_status text;
begin
 if p_outcome not in ('sent','skipped','failed','retry') then
  raise exception 'Invalid delivery outcome' using errcode='22023';
 end if;
 select * into item from public.ccx_email_delivery
 where notification_id=p_notification_id and queue_msg_id=p_msg_id for update;
 if not found then
    -- Parent record can be deleted before a queued message is claimed.
    -- Release the orphan instead of poisoning the queue forever.
    perform pgmq.archive('ccx_member_email',p_msg_id);
    return jsonb_build_object('status','skipped','orphaned',true);
   end if;
 if item.status in('sent','skipped','failed') then
  perform pgmq.archive('ccx_member_email',p_msg_id);
  return jsonb_build_object('status',item.status,'attempts',item.attempts);
 end if;
 attempts_after:=item.attempts+1;
 final_status:=case when p_outcome='retry' and attempts_after>=8 then 'failed'
  when p_outcome='retry' then 'retry' else p_outcome end;
 update public.ccx_email_delivery
 set status=final_status,attempts=attempts_after,
     remote_message_id=case when final_status='sent' then left(coalesce(p_remote_id,''),120) else remote_message_id end,
     last_error=case when final_status in ('failed','retry') then left(coalesce(p_reason,'Delivery unavailable'),180) else null end,
     completed_at=case when final_status='retry' then null else now() end
 where notification_id=p_notification_id;
 if final_status='retry' then
  perform pgmq.set_vt('ccx_member_email',p_msg_id,
    least(21600,greatest(60,coalesce(p_retry_seconds,300))));
 else
  perform pgmq.archive('ccx_member_email',p_msg_id);
 end if;
 return jsonb_build_object('status',final_status,'attempts',attempts_after);
end $function$;

CREATE OR REPLACE FUNCTION public.ccx_transcription_finish(p_recording_id uuid, p_msg_id bigint, p_outcome text, p_reason text DEFAULT NULL::text, p_retry_seconds integer DEFAULT 240)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.ccx_transcription_delivery%rowtype;
declare next_attempt integer;
declare final_status text;
begin
 if p_outcome not in('completed','skipped','retry','failed') then
  raise exception 'Invalid transcription outcome' using errcode='22023';
 end if;
 select * into item from public.ccx_transcription_delivery
 where recording_id=p_recording_id and queue_msg_id=p_msg_id for update;
 if not found then
    -- Parent record can be deleted before a queued message is claimed.
    -- Release the orphan instead of poisoning the queue forever.
    perform pgmq.archive('ccx_audio_transcripts',p_msg_id);
    return jsonb_build_object('status','skipped','orphaned',true);
   end if;
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
end $function$;
