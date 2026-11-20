-- Broadcast call-recording presence so every participant sees when a meeting is recorded.
alter table public.ccx_collab_call_signals
 drop constraint if exists ccx_collab_call_signals_kind_check;
alter table public.ccx_collab_call_signals
 add constraint ccx_collab_call_signals_kind_check
 check (kind in ('join','leave','offer','answer','ice','recording_start','recording_stop'));
