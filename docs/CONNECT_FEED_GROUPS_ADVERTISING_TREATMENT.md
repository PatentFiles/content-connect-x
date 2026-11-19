# Connect Feed, Community Groups and Advertising — Product & Engineering Treatment

**Added November 19, 2026 · Content Connect X / Host Connect**

This treatment is additive to the canonical root README. Bolt remains the website host; Supabase remains the private data, moderation and authorization layer. No hosting migration or automatic relaxation of age/identity verification occurs.

## 1. Product and dashboard contract

Every admitted adult member has a **Connect Feed** inside the dashboard. It is permanent; it is never a widget that can be removed by the Customize button.

The top horizontal dashboard banner contains up to **four** customizable compact widgets. New viewers may see **Friends**, **Unread Messages** and **Upcoming Schedule** as initial suggestions. Existing saved layouts must not be overwritten during migration. The central column hosts post composer and tabs **Friends / Following / Discover**, followed by the social timeline. The right sidebar hosts approved, explicitly labeled **Sponsored** placements. On narrow devices the widget strip scrolls/reflows and the central feed remains full width; the sponsored rail moves after the feed.

## 2. Audience, entitlement and identity

- Every member must hold a durable adult admission and have no active account restriction before using the feed. Being logged in is not the same as being verified.
- **Premium**: may submit posts, photos and reposts (daily limits and moderation apply).
- **Verified Free**: may read authorized posts, like, save, share permitted internal links and submit moderated comments. They cannot publish original posts, upload feed photos or repost.
- Post audiences: **Friends** (default), **Verified Community**, **Only me**. Future group posts have a separate group-member permission. Never infer an audience from sexual orientation, a health/testing field, identity credentials, or private collaborations.
- Friends require accepted two-way `member_connection_requests`. Following is directional. Blocking always wins over friendship/follow status.
- Reposts never broaden an original audience: only published Verified Community originals may be reposted, subject to sharing permission, current audience and blocking. A hidden/deleted original invalidates its repost display. Sharing a link does not grant new access.

## 3. Social publishing

Extend the existing `community_posts` and `community_comments` tables; do not create a competing post universe. Join approved image metadata with `ccx_feed_post_media`; the original photo is never copied on a repost. Reuse the existing private `member-private` Supabase Storage bucket and `media-gateway` upload rights checks. Feed photos must have independently approved media records and uploader rights attestation before any signed, short-lived media URL is returned.

Posts and comments are initially **pending moderation**. Authors see an accurate pending receipt, not a premature publication claim. Provide own-post hide/removal, author-visible notices, rate limiting and a private report flag. Content takedown requires corresponding permissions and audit, and must honor preservation holds. No external raw-ID, testing, medical or signed-contract evidence may be published through a social post. New general social media uploads are non-explicit professional images only until a separate content-provider/legal operation is approved.

Cursor-based pages of at most 16 posts are sorted newest-first initially; do not require algorithmic ranking. Plan for private Realtime Broadcast later, but avoid globally broadcasting sensitive group/post payloads.

## 4. Public and private member groups — required scope

Groups may cover professional interests, identities and consensual adult communities, including kink/BDSM and LGBTQ+/interracial topics. Group titles, descriptions and public search results must remain non-explicit and meet platform policies. **Do not categorize or target members based on inferred sexual orientation, ethnicity, fetish interest or group membership.**

- **Public groups**: searchable by verified adults only. Creating a public group enters platform review. After platform approval, an eligible member can apply to join; one group administrator approves or denies the request. Only approved members see member-restricted posts.
- **Private groups**: are omitted from public search, discovery, search suggestions, sponsorship metadata and directory results. Only an invited member can learn the private group details; invitation must be accepted voluntarily before membership is active.
- **Administration**: founders have an owner role; owner may promote/demote admins. Group admins can invite members, approve/deny public applications and remove members. Removing another member must immediately revoke future group-post access. A group admin cannot access hidden platform records, infer identity details or override platform bans.
- Group invitations, requests, decisions, exits, removals and role changes require server-atomic authorized transitions and an append-only audit. Group owners cannot be silently removed by another group administrator.
- Premium members may create groups and publish posts in their joined groups. Verified Free members can search public groups, apply, accept invitations, read members-only content, react and submit moderated comments.
- Group posts require the same media rights, safety review, reporting, per-post audience restrictions and publication moderation as the global feed. Group posts must not be reposted into broader audiences.
- Members must be able to leave. Do not disclose a user's private-group membership on public profiles or use it for advertising.

Public group discovery remains gated by platform group approval and moderation readiness. Group administrator approval is not a substitute for platform safety policy.

## 5. Advertising and affiliate operations

The right-side sponsored rail is **reserved**, not simulated. Reuse the existing `ccx_sponsorship_campaigns` server-reviewed campaign registry. Show no fake impressions or sponsored businesses when there are no approved campaigns. Campaigns must have approved destinations, clear paid/affiliate disclosure, start/end windows and removal controls.

PPC networks and affiliate companies require an approved advertiser account, verified website ownership, permitted adult-industry creative and destination policies, payout documentation where required, secure credential storage and a privacy/legal review. **Do not activate third-party ad scripts, trackers, pixels or sensitive-interest targeting** just because a network supplies embed code. A generic link is not a validated provider integration.

The previously mentioned uploaded ad-network list could not be verified from the accessible project materials at this release. Its concrete providers, fee terms, approval rules and credentials remain an unresolved external dependency; request the original list or use a directly connected provider after the user connects it. Do not request or display an account password in chat. Website owner must complete credential/contract consent and any provider-specific email verification.

## 6. Acceptance and deployment gates

- Disposable Postgres tests: Free cannot publish; verified Premium posts remain pending; approved photos only; restricted friends-only and deleted-source repost protection; outsiders and blocked members cannot read or interact; user impersonation fails; reports are durable without claiming an emergency response.
- Groups tests: public applications cannot self-approve, private groups cannot be discovered, unauthorized admin cannot invite/remove or promote; no ID/profile-interest exposure; concurrent membership requests are safe.
- Browser tests: keyboard, image loading/revocation, mobile widget rail, empty feeds, moderated comments, upload errors, pagination, account switching, social menu links and safe ad placeholders.
- Backend migration and exact checked-in Edge handlers are deployed **before** Bolt is published again. Verify private RLS, service-only grants and signed media URLs.
- No real user posts, impersonated group activity, ad campaign or provider account is created by test fixtures. Preserve the production public-safety and identity approval flags.

**Tracking:** Feed dashboard, photo/media, community groups and advertising provider activation are separate reviewable releases. Operational safety and production identity acceptance are not waived by a social UI feature.
