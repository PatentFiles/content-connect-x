/*
# Add profile banner and role-specific identity fields

1. Purpose
- Fix the verification/onboarding profile query by ensuring `member_profiles.cover_path` exists.
- Add the identity fields needed for role-aware onboarding without removing or renaming the existing `display_name` field.

2. Modified table: `public.member_profiles`
- `cover_path`: private storage path for a profile banner.
- `real_name`: a creator or professional's legal/real name, kept in the owner profile row.
- `stage_name`: a creator's public professional/stage name.
- `company_name`: optional company or studio name for production professionals.
- `representative_name`: the person managing a studio or company account.

3. Compatibility and data safety
- All changes are additive and nullable, preserving every existing profile row and value.
- Existing `display_name` remains available for older records and existing discovery behavior.
- No existing columns, rows, policies, or storage objects are deleted.

4. Security
- The existing authenticated owner policies on `member_profiles` continue to control access.
- These fields are stored on the private owner profile table and are not exposed through public discovery by this migration.
*/

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS real_name text,
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS representative_name text;