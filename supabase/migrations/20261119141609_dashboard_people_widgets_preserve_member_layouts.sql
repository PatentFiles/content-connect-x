-- Extend the fixed layout catalog only. Existing rows and all authorization checks remain unchanged.
DO $patch$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef('ccx_workspace_private.ccx_dashboard_action(text,jsonb,integer)'::regprocedure) INTO source;
 IF strpos(source,',''account''];')=0 OR strpos(source,'jsonb_array_length(p_layout)>15')=0 OR strpos(source,'FOREACH widget IN ARRAY allowed LOOP')=0 THEN
  RAISE EXCEPTION 'Dashboard source differs from the reviewed version; no changes applied';
 END IF;
 source:=replace(source,',''account''];',',''account'',''featured_professionals'',''featured_creators'',''featured_videographers'',''featured_photographers'',''featured_editors'',''creators_near_me''];');
 source:=replace(source,'jsonb_array_length(p_layout)>15','jsonb_array_length(p_layout)>32');
 source:=replace(source,'FOREACH widget IN ARRAY allowed LOOP',E'FOREACH widget IN ARRAY allowed LOOP\n  -- People cards are fetched separately through the permission-checked directory.\n  -- Never treat a missing people metric as zero or select member records here.\n  IF widget=ANY(ARRAY[''featured_professionals'',''featured_creators'',''featured_videographers'',''featured_photographers'',''featured_editors'',''creators_near_me'']) THEN CONTINUE; END IF;');
 EXECUTE source;
END $patch$;
ALTER TABLE public.member_dashboard_preferences DROP CONSTRAINT member_dashboard_preferences_layout_check;
ALTER TABLE public.member_dashboard_preferences ADD CONSTRAINT member_dashboard_preferences_layout_check CHECK(jsonb_typeof(layout)='array' AND jsonb_array_length(layout)<=32);
COMMENT ON TABLE public.member_dashboard_preferences IS 'Owner-scoped, revisioned dashboard choices. Missing preference means empty; existing choices are not reset. People widgets use the independently authorized directory.';
NOTIFY pgrst,'reload schema';
