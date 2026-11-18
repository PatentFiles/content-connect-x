# Live dashboard, standalone member pages and Host Connect update

Implemented November 17, 2026 (America/Phoenix); migration timestamps use UTC.

## Dashboard repair

The dashboard SQL still checked `age_verified` and returned the retired `verification_required` reason although the application now uses one-time `member_admissions`. The UI interpreted that old reason as unknown configuration, causing every card in the screenshot to show a misleading module-settings error.

The shared SQL function now checks completed signup admission and retains true age verification only for the verification badge. Counts continue to query the signed-in user's actual records, not fixture/random counts. Values legitimately equal to zero are rendered as zero. The dashboard reloads on focus, after supported in-app mutations and every 30 seconds while visible. Admin role-layout previews show the account's common metrics without impersonating another user or bypassing role-specific permissions.

## Member pages and notifications

Messages, Friends, Collaborations and Contracts each retain their own URL and have their own heading and content, without the Member Workspace tab strip. Cross-page messaging and contract actions use route context. Notifications has its own page reached through the header bell. Its requests section offers accept/decline for incoming friend requests and collaboration invitations; existing backend authorization still decides each response. Reads, acceptance and edits refresh shared unread/metric counts. Realtime subscriptions are supplemented by visible-page polling and focus reloads.

## Host experience

- View Local Market opens a viewport-filling native dialog; the close X remains in the dialog header. Closing returns to the dashboard. The embedded map remains available below bookings when the overlay is closed.
- Redundant Property Dashboard navigation buttons are removed from the single-purpose host view.
- Host Settings in the header edits profile photo, display/legal/company names, contact email, phone, city/region/country, mailing address, postal code, languages, biography, time zone and emergency contact. Sign-in email is not changed by editing contact email. Private contact details are owner-readable only; profile photos are stored in a private bucket with a 5MB limit.
- Properties use space-type/country/state/city selectors; child selections reset when the parent geography changes. Location options come from approved public areas and published listing cities.
- Amenities expand into full multi-select cards. The shared catalog includes privacy, changing, hygiene, lighting, sound, storage, access, comfort and safety facilities. "Other" lets authorized hosts add a reusable label, deduplicated case-insensitively and capped at ten additions per day. Labels are plain text; production permissions remain separate. Defaults and per-listing overrides both persist custom keys.
- Backend country/region/city and selected-amenity filters are real database queries. Invalid catalog selections are rejected instead of broadening search. A malformed six-group UUID validator found during inspection was corrected to canonical five-group UUIDs.

## Matterport: playable tours versus raw files

A Matterport Showcase URL is normalized to the official HTTPS origin and model identifier. No arbitrary iframe HTML, alternate origin, credentials or tracking parameters are rendered. Hosts can paste a hosted link or import a `.url`, `.webloc`, `.txt` or `.json` link file. The published hosted model opens in a full-screen iframe with a close X. Tours added to published properties return them to review; unapproved tours remain owner/admin-only.

Raw Matterport ZIP/source files can be stored privately (50MB per archive), but are NOT automatically converted into an interactive model. They still need processing/hosting through Matterport; use the resulting public or unlisted Showcase link. Matterport Import API access is a separate Enterprise integration and is not silently enabled here. Owners should inspect models for address labels, access codes and people before publication.

Official references reviewed:
- https://developers.matterport.com/api/
- https://www.airbnb.com/help/article/3813
- https://supabase.com/changelog.md

## Validation

- Existing 92 local tests passed before adding new tests.
- Added 14 policy/runtime regressions for safe Matterport origins, standalone pages, notifications, filters, custom amenity persistence, authorization and canonical property identifiers.
- Ran 19 live-database checks in rollback-only transactions: all six professional role dashboards, factual admin verification status, RLS/anonymous restrictions, private profile persistence/isolation, custom amenity reuse, host-only insertion, pending tour privacy and untrusted tour rejection. All passed; fixture users/properties/amenities were rolled back.
- Ran 18 Chromium browser checks at 1440×1000 and 390×844 using actual React components with isolated network fixtures. Fullscreen sizing, close behavior, profile saves, amenities, geography reset, six role dashboards, four standalone pages, notifications and Matterport frame mounting passed without page JavaScript errors. The external Matterport player itself was mocked; no claim is made that a customer's private/raw model was processed or played.
- Lint, application typecheck, production build and frontend/backend action/import checks passed. Provider acceptance, real paid bookings and real media processing are not certified by these checks.

No MFA requirement or per-feature age-verification requirement was reintroduced. Supabase-managed keys, external provider credentials and payment approvals are unchanged.
