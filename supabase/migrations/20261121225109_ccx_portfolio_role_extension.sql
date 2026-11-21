-- Extend the existing verified-member professional portfolio mutation while retaining all authorization and storage checks.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_portfolio_action(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); item public.member_portfolio_items; path text; link text; kind text;
BEGIN
 IF NOT public.ccx_workspace_allowed(NULL,ARRAY['photographer','videographer','video_editor','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider']) THEN RAISE EXCEPTION 'Verified portfolio owner required' USING ERRCODE='42501'; END IF;
 IF p_action='save' THEN
  IF NOT public.ccx_workspace_allowed('portfolio') THEN RAISE EXCEPTION 'Portfolio is disabled' USING ERRCODE='42501'; END IF;
  kind:=p_data->>'kind';path:=nullif(p_data->>'storage_path','');link:=nullif(trim(p_data->>'external_url'),'');
  IF kind='photo' THEN
   IF path IS NULL OR split_part(path,'/',1)<>u::text OR path LIKE '%..%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ccx-professional-portfolios' AND name=path) THEN RAISE EXCEPTION 'Upload your photo first'; END IF;link:=NULL;
  ELSIF kind='link' THEN
   IF link IS NULL OR length(link)>2000 OR link!~'^https://[^[:space:]@]+$' THEN RAISE EXCEPTION 'Use a valid HTTPS work link'; END IF;path:=NULL;
  ELSE RAISE EXCEPTION 'Choose a photo or work link'; END IF;
  INSERT INTO public.member_portfolio_items(user_id,kind,title,description,storage_path,external_url) VALUES(u,kind,trim(p_data->>'title'),left(coalesce(p_data->>'description',''),2000),path,link) RETURNING * INTO item;
 ELSIF p_action='feature' THEN
  UPDATE public.member_portfolio_items SET featured=coalesce((p_data->>'featured')::boolean,false) WHERE id=(p_data->>'id')::uuid AND user_id=u RETURNING * INTO item;
 ELSIF p_action='delete' THEN
  DELETE FROM public.member_portfolio_items WHERE id=(p_data->>'id')::uuid AND user_id=u RETURNING * INTO item;
 ELSE RAISE EXCEPTION 'Unknown portfolio action'; END IF;
 IF item.id IS NULL THEN RAISE EXCEPTION 'Portfolio item unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('item',to_jsonb(item));
END $function$
;
