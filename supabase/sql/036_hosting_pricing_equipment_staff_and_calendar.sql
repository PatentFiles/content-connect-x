-- CCX hosting expansion: pricing, map areas, inventory, cleaning operations and production safety.
-- RLS protects every table. Trusted Edge Functions perform all mutations.

CREATE TABLE IF NOT EXISTS public.hosting_public_areas(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 city text NOT NULL, region text NOT NULL DEFAULT '', country text NOT NULL,
 latitude numeric(9,5) NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude numeric(9,5) NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 radius_km integer NOT NULL DEFAULT 5 CHECK(radius_km BETWEEN 1 AND 50),
 approved boolean NOT NULL DEFAULT true,
 UNIQUE(city,region,country)
);
ALTER TABLE public.hosting_public_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_area_read ON public.hosting_public_areas FOR SELECT TO authenticated USING(approved=true);
INSERT INTO public.hosting_public_areas(city,region,country,latitude,longitude,radius_km) VALUES
 ('Los Angeles','CA','United States',34.05223,-118.24368,12),
 ('Hollywood','CA','United States',34.09834,-118.32674,5),
 ('West Hollywood','CA','United States',34.09001,-118.36174,4),
 ('Burbank','CA','United States',34.18084,-118.30897,5),
 ('Santa Monica','CA','United States',34.01945,-118.49119,5),
 ('Long Beach','CA','United States',33.77005,-118.19374,8),
 ('San Francisco','CA','United States',37.77493,-122.41942,8),
 ('Las Vegas','NV','United States',36.16994,-115.13983,10),
 ('Phoenix','AZ','United States',33.44838,-112.07404,12),
 ('New York','NY','United States',40.71278,-74.00597,12),
 ('Miami','FL','United States',25.76168,-80.19179,9),
 ('Atlanta','GA','United States',33.74899,-84.38798,9),
 ('Chicago','IL','United States',41.87811,-87.62980,10)
 ON CONFLICT(city,region,country) DO NOTHING;

ALTER TABLE public.properties
 ADD COLUMN IF NOT EXISTS public_area_id uuid REFERENCES public.hosting_public_areas(id),
 ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles',
 ADD COLUMN IF NOT EXISTS min_notice_hours integer NOT NULL DEFAULT 24 CHECK(min_notice_hours BETWEEN 0 AND 720),
 ADD COLUMN IF NOT EXISTS weekend_bps integer NOT NULL DEFAULT 10000 CHECK(weekend_bps BETWEEN 1000 AND 40000),
 ADD COLUMN IF NOT EXISTS holiday_bps integer NOT NULL DEFAULT 10000 CHECK(holiday_bps BETWEEN 1000 AND 40000),
 ADD COLUMN IF NOT EXISTS overtime_bps integer NOT NULL DEFAULT 15000 CHECK(overtime_bps BETWEEN 10000 AND 50000),
 ADD COLUMN IF NOT EXISTS cleaning_fee_cents bigint NOT NULL DEFAULT 0 CHECK(cleaning_fee_cents BETWEEN 0 AND 10000000),
 ADD COLUMN IF NOT EXISTS preferred_cleaning_minutes integer NOT NULL DEFAULT 120 CHECK(preferred_cleaning_minutes BETWEEN 0 AND 1440);

CREATE TABLE IF NOT EXISTS public.hosting_seasonal_rates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(label) BETWEEN 3 AND 120),
 starts_on date NOT NULL, ends_on date NOT NULL,
 multiplier_bps integer NOT NULL CHECK(multiplier_bps BETWEEN 1000 AND 40000),
 kind text NOT NULL DEFAULT 'seasonal' CHECK(kind IN ('seasonal','holiday','promotion')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on),
 CHECK(ends_on-starts_on<=366)
);
CREATE INDEX IF NOT EXISTS hosting_seasonal_property ON public.hosting_seasonal_rates(property_id,starts_on,ends_on);
ALTER TABLE public.hosting_seasonal_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_seasonal_owner_read ON public.hosting_seasonal_rates FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_discount_codes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 code_sha256 text NOT NULL CHECK(code_sha256 ~ '^[0-9a-f]{64}$'),
 discount_bps integer NOT NULL CHECK(discount_bps BETWEEN 1 AND 8000),
 max_redemptions integer NOT NULL DEFAULT 50 CHECK(max_redemptions BETWEEN 1 AND 100000),
 redemptions integer NOT NULL DEFAULT 0 CHECK(redemptions>=0),
 expires_at timestamptz,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(property_id,code_sha256),
 CHECK(redemptions<=max_redemptions)
);
ALTER TABLE public.hosting_discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_discount_owner_read ON public.hosting_discount_codes FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_addons(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(label) BETWEEN 3 AND 160),
 category text NOT NULL CHECK(category IN ('camera','lighting','audio','furniture','set','makeup','equipment','service','other')),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=1500),
 quantity integer NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 1000),
 hourly_cents integer NOT NULL CHECK(hourly_cents BETWEEN 0 AND 10000000),
 daily_cents integer CHECK(daily_cents BETWEEN 0 AND 10000000),
 condition text NOT NULL DEFAULT 'good' CHECK(condition IN ('new','good','fair','maintenance','retired')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hosting_addons_prop ON public.hosting_addons(property_id,category,active);
ALTER TABLE public.hosting_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_addon_owner_read ON public.hosting_addons FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_addon_bundles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 120),
 discount_bps integer NOT NULL DEFAULT 0 CHECK(discount_bps BETWEEN 0 AND 8000),
 active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.hosting_addon_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_bundle_owner ON public.hosting_addon_bundles FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_bundle_items(
 bundle_id uuid NOT NULL REFERENCES public.hosting_addon_bundles(id) ON DELETE CASCADE,
 addon_id uuid NOT NULL REFERENCES public.hosting_addons(id) ON DELETE CASCADE,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000),
 PRIMARY KEY(bundle_id,addon_id)
);
ALTER TABLE public.hosting_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_bundle_item_owner ON public.hosting_bundle_items FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.hosting_addon_bundles b JOIN public.properties p ON p.id=b.property_id
 WHERE b.id=bundle_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_booking_addons(
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 addon_id uuid NOT NULL REFERENCES public.hosting_addons(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000),
 hourly_cents_snapshot integer NOT NULL CHECK(hourly_cents_snapshot>=0),
 total_cents bigint NOT NULL CHECK(total_cents>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(booking_id,addon_id)
);
ALTER TABLE public.hosting_booking_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_booking_addon_participants ON public.hosting_booking_addons FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id AND
 (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

CREATE TABLE IF NOT EXISTS public.hosting_equipment_inspections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 addon_id uuid NOT NULL REFERENCES public.hosting_addons(id),
 condition_before text CHECK(condition_before IN ('new','good','fair','damaged')),
 condition_after text CHECK(condition_after IN ('new','good','fair','damaged')),
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=1500),
 recorded_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(booking_id,addon_id,recorded_by)
);
ALTER TABLE public.hosting_equipment_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_equipment_inspector_owner ON public.hosting_equipment_inspections FOR SELECT TO authenticated
 USING(recorded_by=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.hosting_staff(
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('cleaner','manager','coordinator','assistant','security')),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','declined','removed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_at timestamptz,
 PRIMARY KEY(property_id,member_id)
);
ALTER TABLE public.hosting_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_staff_self_read ON public.hosting_staff FOR SELECT TO authenticated
 USING(member_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.hosting_supplies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(label) BETWEEN 2 AND 140),
 unit text NOT NULL DEFAULT 'units' CHECK(char_length(unit)<=24),
 quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK(quantity>=0),
 reorder_at numeric(12,2) NOT NULL DEFAULT 0 CHECK(reorder_at>=0),
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=500),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hosting_supplies_prop ON public.hosting_supplies(property_id);
ALTER TABLE public.hosting_supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_supplies_owner ON public.hosting_supplies FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_supply_movements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 supply_id uuid NOT NULL REFERENCES public.hosting_supplies(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 change_quantity numeric(12,2) NOT NULL CHECK(change_quantity<>0),
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=200),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_supply_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_supply_movements_self ON public.hosting_supply_movements FOR SELECT TO authenticated
 USING(actor_id=(SELECT auth.uid()));

ALTER TABLE public.property_turnovers
 ADD COLUMN IF NOT EXISTS booking_triggered boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS started_at timestamptz,
 ADD COLUMN IF NOT EXISTS quality_rating smallint CHECK(quality_rating BETWEEN 1 AND 5),
 ADD COLUMN IF NOT EXISTS owner_feedback text CHECK(char_length(owner_feedback)<=1000),
 ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.hosting_booking_access(
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('coordinator','assistant','security','cleaner','crew')),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','declined','revoked')),
 can_view_entry boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_at timestamptz,
 PRIMARY KEY(booking_id,user_id)
);
ALTER TABLE public.hosting_booking_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_booking_access_self ON public.hosting_booking_access FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.hosting_booking_conversations(
 booking_id uuid PRIMARY KEY REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_booking_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_conversation_owner_read ON public.hosting_booking_conversations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id AND
 (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

CREATE TABLE IF NOT EXISTS public.hosting_booking_insurance(
 booking_id uuid PRIMARY KEY REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 submitted_by uuid NOT NULL REFERENCES auth.users(id),
 document_path text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired')),
 policy_holder text NOT NULL DEFAULT '' CHECK(char_length(policy_holder)<=160),
 expiry_date date,
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_booking_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_booking_insurance_submitter ON public.hosting_booking_insurance FOR SELECT TO authenticated
 USING(submitted_by=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.hosting_check_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL CHECK(event_type IN ('check_in','check_out','host_confirm','no_show')),
 actual_at timestamptz NOT NULL DEFAULT now(),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(booking_id,event_type)
);
ALTER TABLE public.hosting_check_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_check_event_actor ON public.hosting_check_events FOR SELECT TO authenticated
 USING(actor_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.hosting_incidents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 reporter_id uuid NOT NULL REFERENCES auth.users(id),
 category text NOT NULL CHECK(category IN ('damage','equipment','safety','conduct','access','other')),
 description text NOT NULL CHECK(char_length(description) BETWEEN 10 AND 3000),
 evidence_path text,
 status text NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','reviewing','resolved','closed')),
 resolved_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_incident_reporter ON public.hosting_incidents FOR SELECT TO authenticated
 USING(reporter_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.hosting_calendar_connections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('airbnb','vrbo','booking','other')),
 import_url text NOT NULL CHECK(char_length(import_url)<=1800),
 sync_enabled boolean NOT NULL DEFAULT false,
 last_synced_at timestamptz,
 last_error text,
 next_sync_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(property_id,provider)
);
ALTER TABLE public.hosting_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_calendar_owner ON public.hosting_calendar_connections FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.hosting_calendar_export_tokens(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_calendar_export_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_export_token_owner ON public.hosting_calendar_export_tokens FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=(SELECT auth.uid())));

-- No API-generated map may expose property_private latitude or longitude.
CREATE INDEX IF NOT EXISTS hosting_property_public_area ON public.properties(public_area_id);
