-- Group messaging with mutually approved members; server-created only.
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'direct' CHECK(kind IN ('direct','group'));
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS conversation_messages_recent ON public.messages(conversation_id,created_at DESC);
