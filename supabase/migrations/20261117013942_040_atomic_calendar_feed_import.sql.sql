-- Atomically import remote iCalendar blocks after checking existing bookings.
-- Sync never transfers guest names, notes, phone numbers or provider credentials.
CREATE OR REPLACE FUNCTION public.ccx_hosting_replace_calendar_blocks(
 p_connection uuid,p_events jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE connection public.hosting_calendar_connections%rowtype;
 venue public.properties%rowtype;
 element jsonb;
 updated_ids text[]:=ARRAY[]::text[];
 started timestamptz;ended timestamptz;
 digest text;
 added integer:=0;removed integer:=0;
 BEGIN
 SELECT * INTO connection FROM public.hosting_calendar_connections WHERE id=p_connection FOR UPDATE;
 IF NOT FOUND OR NOT connection.sync_enabled THEN RAISE EXCEPTION 'Calendar connection disabled'; END IF;
 SELECT * INTO venue FROM public.properties WHERE id=connection.property_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;
 IF jsonb_typeof(p_events)<>'array' OR jsonb_array_length(p_events)>500
 THEN RAISE EXCEPTION 'Invalid or excessive calendar events'; END IF;
 -- Validate ALL events before applying any changed blocks.
 FOR element IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  IF NOT element ? 'uid_hash' OR (element->>'uid_hash') !~ '^[0-9a-f]{64}$'
   THEN RAISE EXCEPTION 'Invalid event identifier'; END IF;
  started:=(element->>'starts_at')::timestamptz;
  ended:=(element->>'ends_at')::timestamptz;
  IF ended<=started OR ended-started>interval '90 days' THEN RAISE EXCEPTION 'Unsupported external booking duration'; END IF;
  IF EXISTS(SELECT 1 FROM public.property_booking_requests b
   WHERE b.property_id=venue.id AND b.status IN ('requested','accepted')
    AND b.starts_at<ended AND b.ends_at>started) THEN
    RAISE EXCEPTION 'Remote booking conflicts with a local reservation';
  END IF;
  updated_ids:=array_append(updated_ids,element->>'uid_hash');
 END LOOP;
 -- Revisions are made under the venue lock; existing booking triggers remain authoritative.
 FOR element IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  digest:=element->>'uid_hash';
  started:=(element->>'starts_at')::timestamptz;
  ended:=(element->>'ends_at')::timestamptz;
  INSERT INTO public.property_unavailable(property_id,blocked_by,starts_at,ends_at,reason,source,source_uid_hash,connection_id)
  VALUES(venue.id,venue.owner_id,started,ended,'External calendar unavailable','ics_upload',digest,connection.id)
  ON CONFLICT(property_id,source_uid_hash) DO UPDATE SET
   starts_at=excluded.starts_at,ends_at=excluded.ends_at,connection_id=connection.id,
   reason='External calendar unavailable',source='ics_upload';
  added:=added+1;
 END LOOP;
 DELETE FROM public.property_unavailable b
  WHERE b.connection_id=connection.id AND b.source='ics_upload'
   AND NOT(b.source_uid_hash=ANY(updated_ids));
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN jsonb_build_object('synchronized',added,'removed',removed);
END $$;
REVOKE ALL ON FUNCTION public.ccx_hosting_replace_calendar_blocks(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_hosting_replace_calendar_blocks(uuid,jsonb) TO service_role;