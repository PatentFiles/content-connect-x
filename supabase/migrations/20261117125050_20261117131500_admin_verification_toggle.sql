/*
# Admin self-verification toggle function

1. New Functions
- `admin_toggle_self_verification`: SECURITY DEFINER function that allows an admin to toggle their own age verification status between 'approved' (with 100-year expiry) and 'pending'. Only callable by users with admin=true in account_security.

2. Security
- SECURITY DEFINER so it can write to age_verification_requests (which has no client INSERT/UPDATE policy).
- Revoke EXECUTE from PUBLIC and anon; grant to authenticated only.
- Caller must have admin=true in account_security — checked inside the function body.
- Uses auth.uid() for caller identity (not a parameter).

3. Important notes
- This is for developer testing only — lets the admin enable/disable their own verification without going through the full age review flow.
- When toggling ON: sets status='approved', verified_at=now(), expires_at=now()+100 years.
- When toggling OFF: deletes existing verification requests so the admin can test the verification flow from scratch.
*/

CREATE OR REPLACE FUNCTION public.admin_toggle_self_verification(p_enable boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT admin INTO v_is_admin FROM public.account_security WHERE user_id = v_caller;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF p_enable THEN
    DELETE FROM public.age_verification_requests WHERE user_id = v_caller;
    INSERT INTO public.age_verification_requests (user_id, status, provider, verified_at, expires_at, reviewed_at)
    VALUES (v_caller, 'approved', 'admin_self_test', now(), now() + interval '100 years', now());
  ELSE
    DELETE FROM public.age_verification_requests WHERE user_id = v_caller;
  END IF;

  RETURN jsonb_build_object('enabled', p_enable, 'user_id', v_caller);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_toggle_self_verification(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_self_verification(boolean) TO authenticated;
