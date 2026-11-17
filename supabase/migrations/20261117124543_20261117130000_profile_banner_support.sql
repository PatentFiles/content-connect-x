/*
# Add profile banner storage reference

1. New columns
- `member_profiles.cover_path`: private-storage path for the member's profile banner.

2. Modified tables
- `member_profiles`: adds a non-sensitive user-owned presentation field without changing existing avatar data.

3. Security
- Existing authenticated owner policies continue to control profile row access.
- The application stores only a storage path; private files remain protected by storage policies.

4. Important notes
- This migration is additive and preserves all existing profile data.
- Profile image uploads remain limited to the authenticated member's own storage folder.
*/

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS cover_path text;
