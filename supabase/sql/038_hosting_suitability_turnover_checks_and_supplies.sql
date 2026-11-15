-- Venue production credentials, incident trail, overtime and automatic turnovers.
CREATE TABLE IF NOT EXISTS public.hosting_suitability(
 property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
 adult_production_permitted boolean NOT NULL DEFAULT false,
 noise_restrictions text NOT NULL DEFAULT '' CHECK(char_length(noise_restrictions)<=600),
 privacy_level text NOT NULL DEFAULT 'standard' CHECK(privacy_level IN ('standard','private_entry','closed_set')),
 soundproof_confirmed boolean NOT NULL DEFAULT false,
 parking_spaces integer NOT NULL DEFAULT 0 CHECK(parking_spaces BETWEEN 0 AND 1000),
 separate_dressing_rooms integer NOT NULL DEFAULT 0 CHECK(separate_dressing_rooms BETWEEN 0 AND 100),
 permits_verified boolean NOT NULL DEFAULT false,
 reviewer_id uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT permits_verified OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
ALTER TABLE public.hosting_suitability ENABLE ROW LEVEL SECURITY;
CREATE POLICY suitability_host_read ON public.hosting_suitability FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_overtime_quotes(
 booking_id uuid PRIMARY KEY REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 minutes_late integer NOT NULL CHECK(minutes_late BETWEEN 1 AND 4320),
 proposed_cents bigint NOT NULL CHECK(proposed_cents>=0),
 status text NOT NULL DEFAULT 'unbilled' CHECK(status IN ('unbilled','disputed','approved','waived','provider_paid')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_overtime_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY overtime_booking_parties ON public.hosting_overtime_quotes FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id
  AND (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

CREATE UNIQUE INDEX IF NOT EXISTS auto_turnover_one_per_booking
 ON public.property_turnovers(booking_id) WHERE booking_triggered AND booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ccx_schedule_completed_rental_cleaning()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE job uuid; clean_minutes integer;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
  SELECT preferred_cleaning_minutes INTO clean_minutes FROM public.properties WHERE id=NEW.property_id;
  INSERT INTO public.property_turnovers(property_id,booking_id,created_by,status,due_at,booking_triggered)
  VALUES(NEW.property_id,NEW.id,NEW.owner_id,'todo',
   NEW.ends_at+make_interval(mins=>coalesce(clean_minutes,120)),true)
  ON CONFLICT DO NOTHING RETURNING id INTO job;
  IF job IS NOT NULL THEN
   INSERT INTO public.property_turnover_tasks(turnover_id,label,position) VALUES
    (job,'Inspect equipment and power',0),
    (job,'Clean and sanitize production set',1),
    (job,'Inspect rooms and dressing facilities',2),
    (job,'Check bathrooms and replenishment',3),
    (job,'Document before and after condition',4),
    (job,'Secure doors and access equipment',5);
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_auto_schedule_turnover ON public.property_booking_requests;
CREATE TRIGGER ccx_auto_schedule_turnover AFTER UPDATE OF status ON public.property_booking_requests
 FOR EACH ROW EXECUTE FUNCTION public.ccx_schedule_completed_rental_cleaning();

-- Staff-adjusted stock must lock the inventory row, never accept client totals.
CREATE OR REPLACE FUNCTION public.ccx_hosting_adjust_supply(
 p_actor uuid,p_supply uuid,p_delta numeric,p_reason text
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_quantity numeric; venue uuid; new_quantity numeric;
BEGIN
 SELECT quantity,property_id INTO old_quantity,venue FROM public.hosting_supplies WHERE id=p_supply FOR UPDATE;
 IF venue IS NULL THEN RAISE EXCEPTION 'Supply not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=venue AND owner_id=p_actor)
   AND NOT EXISTS(SELECT 1 FROM public.hosting_staff WHERE property_id=venue
    AND member_id=p_actor AND status='active' AND role IN ('manager','cleaner')) THEN
    RAISE EXCEPTION 'Not authorized for this property'; END IF;
 new_quantity:=old_quantity+p_delta;
 IF new_quantity<0 OR new_quantity>1000000 OR p_delta=0 THEN RAISE EXCEPTION 'Stock adjustment out of range'; END IF;
 UPDATE public.hosting_supplies SET quantity=new_quantity,updated_at=now() WHERE id=p_supply;
 INSERT INTO public.hosting_supply_movements(supply_id,actor_id,change_quantity,reason)
 VALUES(p_supply,p_actor,p_delta,left(coalesce(p_reason,''),200));
 RETURN new_quantity;
END $$;
REVOKE ALL ON FUNCTION public.ccx_hosting_adjust_supply(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_hosting_adjust_supply(uuid,uuid,numeric,text) TO service_role;

-- Equipment condition changes and incident evidence stay separate from payouts.
CREATE OR REPLACE FUNCTION public.ccx_check_equipment_before_after()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.hosting_booking_addons a
   WHERE a.booking_id=NEW.booking_id AND a.addon_id=NEW.addon_id) THEN
   RAISE EXCEPTION 'Condition report must refer to rented equipment';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_verify_equipment_inspection ON public.hosting_equipment_inspections;
CREATE TRIGGER ccx_verify_equipment_inspection BEFORE INSERT OR UPDATE ON public.hosting_equipment_inspections
 FOR EACH ROW EXECUTE FUNCTION public.ccx_check_equipment_before_after();

-- Prevent host-directed authorization from being silently granted in a new invitation.
CREATE OR REPLACE FUNCTION public.ccx_guard_hosting_access()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='invited' AND NEW.can_view_entry THEN RAISE EXCEPTION 'Guest entry access requires acceptance and explicit permission'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_guard_invite_access ON public.hosting_booking_access;
CREATE TRIGGER ccx_guard_invite_access BEFORE INSERT OR UPDATE ON public.hosting_booking_access
 FOR EACH ROW EXECUTE FUNCTION public.ccx_guard_hosting_access();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('hosting-incident-evidence','hosting-incident-evidence',false,10485760,
 ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];
