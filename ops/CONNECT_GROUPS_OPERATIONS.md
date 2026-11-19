# Connect Groups — Private Membership and Moderation Operations

**Content Connect X / Host Connect · November 19, 2026**
**Status:** Implementation and CI review; group-specific images and third-party advertising remain separately gated.

## Product boundaries

Public groups may cover adult professional and consensual interests, including LGBTQ+ and fetish communities, subject to the same non-explicit descriptions and platform rules as the rest of the site. Do not infer an individual's sexual orientation, ethnicity, relationship practices or sensitive traits from groups. Neither private group membership nor public applications can be advertising-targeting attributes.

**Public groups** appear in verified-member search only after independent platform approval. Until then, only their founder and authorized platform reviewers can see the pending listing. Verified adults submit a membership application, and the group's owner or administrator approves or denies it. No application auto-approves.

**Private groups** never appear in search or sitewide discovery. An eligible member invited by an active group administrator must accept the invitation voluntarily; being invited does not make them an active member. The invitee can decline. Only active members can read group content and interact.

## Roles and protections

- Group creation requires admitted adult Premium membership, with a limit of five founder groups per account. Verified Free members can discover public groups, apply, accept invitations and engage within accepted groups.
- Every operation verifies caller identity through Supabase Auth and repeats admission, ban/suspension, role and membership checks inside the service-only SQL function. Browser database roles cannot directly read group membership or call this function.
- Group owners can promote/demote administrators; owners and admins can approve/deny requests and invite eligible members. Administrators cannot remove owners or other administrators; owners cannot abandon their group without an independently designed ownership-transfer process.
- Membership removal or departure must stop future group-post reads. Existing signed media links must not be used for group-only posts (group photos remain disabled until private group media authorization is independently designed).
- Group events are append-only and record requester, actor, target and action; no text containing private identity, sex-life or medical details is put in event metadata.
- Site-level administrators must pass current MFA AAL2 before accepting/rejecting public group listings; an admin who founded a group cannot approve that same group.

## Moderation and incident handling

New public group names/descriptions/rules require platform review before search visibility. Every group post or comment requires separate existing content moderation. Group text posts are Premium-only and share the daily post limit; verified Free members with active membership may read/react/comment. Posting does not grant identity, legal consent, membership or emergency response permissions.

Inappropriate content, threats, illegal material, doxing, unauthorized images or harassment must be handled through the restricted reporting and appeals process. The existing public report-intake launch gate stays **closed** until the operator establishes staffed coverage. Group admins are not platform trust/safety reviewers and cannot override a platform restriction.

## Acceptance checklist

Use synthetic accounts and an isolated PostgreSQL test service first. Confirm:
1. Unadmitted/blocked members cannot discover, join or administer groups.
2. A pending public group cannot be discovered; independent MFA site review is required.
3. Public applications require a group-admin decision; unauthorized approvals and role changes fail.
4. Private group names/membership cannot be enumerated from public discovery, feed, user profile or third-party advertising.
5. Invited users cannot view group content before accepting; removal and leaving immediately reject future reads.
6. Group owner and administrator permissions remain distinct, including simultaneous membership decisions and denied self-review.
7. Group posts remain in moderation, and private-group content never appears in Friends, Following or Discover global feeds.
8. Only Premium active group members can publish; verified Free active members can react and submit moderated comments.
9. Keyboard/mobile access, account switching, error states, notifications and existing dashboard are preserved.

Deploy the reviewed SQL migration and exact checked-in `connect-groups` Edge Function with JWT verification before using the new Bolt build. Since the group migration updates global feed visibility, redeploy the matching `connect-feed` Edge handler too. After deployment, verify the live project is the existing Supabase project, that RLS is enabled, that ordinary browser roles have no access to the group tables/RPC, and that identity/public safety switches are unchanged.

Rollback consists of disabling the new UI and reverting Edge handlers to their last safe known versions while retaining member/audit history. Never delete group membership data to force a successful test.

**Not included in this release:** private-group photos/video, automated emergency dispatch, live third-party advertising, compulsory group invitations, visibility of private memberships on profiles, or a claim of operational public safety staffing.
