-- Database-enforced event capacity and resilient chat edit/delete history.
CREATE OR REPLACE FUNCTION public.enforce_production_event_capacity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE maximum integer; booked integer;
BEGIN
 IF NEW.status <> 'going' THEN RETURN NEW; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.event_id::text, 0));
 SELECT capacity INTO maximum FROM public.production_events WHERE id=NEW.event_id FOR UPDATE;
 IF maximum IS NULL THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 SELECT count(*) INTO booked FROM public.production_event_rsvps
  WHERE event_id=NEW.event_id AND status='going' AND user_id<>NEW.user_id;
 IF booked >= maximum THEN RAISE EXCEPTION 'Event has reached capacity'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_event_capacity ON public.production_event_rsvps;
CREATE TRIGGER enforce_event_capacity BEFORE INSERT OR UPDATE OF status ON public.production_event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.enforce_production_event_capacity();
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS public.message_reactions (
 message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
 reactor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 reaction text NOT NULL CHECK (reaction IN ('like','heart','laugh','support')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(message_id,reactor_id)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_sees_own_message_reaction ON public.message_reactions FOR SELECT TO authenticated
 USING(reactor_id=(select auth.uid()));
CREATE TABLE IF NOT EXISTS public.message_revision_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id uuid NOT NULL REFERENCES public.messages(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL CHECK (event_type IN ('edit','delete')),
 content_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_revision_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_message_revision ON public.message_revision_audit FOR SELECT TO authenticated
 USING(actor_id=(select auth.uid()));
-- No direct member write policies on moderated chat events or messages.
