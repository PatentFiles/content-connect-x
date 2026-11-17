# Role workspace restoration — 2026-11-17

## Source and scope
The original role menu and portrait-card hierarchy were read from the preserved `reference/original-base44-pre-supabase` branch at `00640e05b91478d544dd590084a3f423bf52a47e`. Supabase remains the only backend. This change restores CCX role navigation, role-specific profiles, roster and portfolio workflows, and local Discovery/city Search with shared favorites.

Desktop/mobile hero assets, public marketing, verification gates, membership prices, payment activation, existing creator preferences, existing media/gallery records, and OnlyHost's separate host management are not replaced. The original creator, production and media implementations are retained verbatim in the `*Base.jsx` modules, with small routing wrappers.

## Navigation and profiles
- All six CCX roles have Discovery, Search, Favorites, Connections, Messages and Properties.
- Creator retains Testing, Collaborations, Contracts, Verification and creator profile settings.
- Agent and Studio have Roster. My Profile displays agency/studio settings rather than performer acts or health preferences.
- Photographer, Videographer and Video Editor have Portfolio and professional-service settings.
- The Host role is omitted from CCX's dashboard switcher. Its existing marketplace backend and the separate OnlyHost application are preserved.
- Admin previews change presentation only. They never grant a different role's database privileges or overwrite the real account's profile.
- Missing feature responses no longer silently remove the entire optional menu. Page and backend authorization still fail closed. Navigation reads evaluated settings through `ccx_member_feature_flags`.

## Backend additions
Applied only to canonical Supabase project `yxuqbygykpfbioslljlf`:
`20261117155343_restore_role_workspaces_rosters_portfolios.sql`.

New owner/participant-scoped tables: `member_professional_details`, `member_representations`, `member_portfolio_items`. Browser mutations go through authenticated role-checking RPCs; direct table mutations are revoked. All tables have RLS. The portfolio storage bucket is private with a 10 MiB JPEG/PNG/WebP limit.

Roster invitations begin as pending. Only the invited creator can accept/decline; either participant can end the relationship. History remains. This does not confer contract-signing authority. New work samples are private portfolio drafts; the existing gallery publication/moderation rules are unchanged. Video work is stored as validated HTTPS links, not arbitrary embedded scripts.

Discovery defaults to the member's stored general city. Search can select another city. All three directory modes use `MemberDiscoveryCard` and `creator_favorites`. Avatar signing is limited to the eligible owner's profile-avatar path, never medical/verification/gallery paths. Existing consented identity filters, age checks, membership limits and blocks remain enforced.

## Verification boundaries
41 live database checks passed under the authenticated role using synthetic identities in a transaction that was rolled back. These cover six-role navigation flags, five professional profile saves, agent/studio invitation and acceptance restrictions, portfolio ownership, mutations and privacy, and anonymous RPC denial. No synthetic users or approvals are retained.

The role policy tests and actual React server-render checks are included in CI. These do not substitute for an authenticated mobile browser upload and cross-account usability session. Test publishing the frontend after syncing main; this change does not publish the Bolt site automatically.
