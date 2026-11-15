-- Member workflows for Supabase replacement. All premium mutations are brokered by
-- authenticated Edge Functions which verify age, entitlement and membership.
CREATE TABLE IF NOT EXISTS public.contract_signatures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
 signer_id uuid NOT NULL REFERENCES auth.users(id),
 signed_content_hash text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(contract_id,signer_id)
);
CREATE TABLE IF NOT EXISTS public.property_booking_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id),
 requester_id uuid NOT NULL REFERENCES auth.users(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','accepted','declined','cancelled','completed')),
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_bookings_property_time ON public.property_booking_requests(property_id,starts_at,ends_at);
CREATE TABLE IF NOT EXISTS public.member_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL,
 title text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.member_notifications(recipient_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.platform_action_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES auth.users(id),
 action text NOT NULL,
 target_type text,
 target_id uuid,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_action_audit ENABLE ROW LEVEL SECURITY;
-- Read access is scoped by the authenticated user; only trusted functions write.
CREATE POLICY "signature owner reads" ON public.contract_signatures FOR SELECT TO authenticated USING (signer_id=(select auth.uid()));
CREATE POLICY "member reads own bookings" ON public.property_booking_requests FOR SELECT TO authenticated USING (requester_id=(select auth.uid()) OR owner_id=(select auth.uid()));
CREATE POLICY "member reads own notifications" ON public.member_notifications FOR SELECT TO authenticated USING (recipient_id=(select auth.uid()));
CREATE POLICY "member reads own audit" ON public.platform_action_audit FOR SELECT TO authenticated USING (actor_id=(select auth.uid()));
-- A conversation row is accessed through membership after authorized server creation.
-- Unlike no policies, explicit SELECT is still constrained by the caller's membership.
CREATE POLICY "conversation memberships" ON public.conversations FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id=id AND cm.user_id=(select auth.uid()))
);
-- Service-role operations only for creation of premium entities. In particular
-- neither anonymous nor authenticated users can bypass entitlement gates through REST.
