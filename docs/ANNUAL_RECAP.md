# Content Connect X — Annual Year in Review

## Release state

The annual recap is implemented in GitHub main and its private schema, Edge Function, and pg_cron job have been deployed to the connected Supabase project. The existing Bolt frontend must be published from main to expose the Personal → Year in Review page.

First complete year: **2026 activity**, delivered starting **January 1, 2027 at 15:00 UTC**. Activity predating the platform cannot be reconstructed. Never invent historical achievements.

## Eligible professional roles

Creator, photographer, videographer, video editor, agent and studio all receive reports if their accounts are admitted and active. The database captures the role at generation time.

## Trusted achievement counts

| Measure | How it is calculated |
|---|---|
| Collaborations | Non-draft collaborations created in the report year that the member created or joined |
| Completed projects | Those collaborations currently completed or closed |
| New friends | Distinct accepted connection partners with response date in the year |
| Published posts | Published, nonhidden posts from the year |
| Featured portfolio items | Featured entries created in the year |
| Approved media | Approved verified-audience media created in the year |
| Shared trips | Member-visible travel starting in the year |
| New representation | Mutually accepted, currently active agreements started in the year |

These are verified database counts, not proof of commercial revenue, completed shoots, signed releases or medical eligibility. No ID photos, private messages, medical results, sexual preferences, addresses, or other members' identities are copied into the report.

## Reliable scheduling

The private database job named **ccx-annual-recap-january** runs every five minutes January 1–7. The database function itself refuses generation before January 1 at 15:00 UTC. It generates bounded batches of 500 accounts and uses a transaction-level advisory lock plus a unique (user,year) key, so retries cannot create duplicate yearly reports. A successful transaction also creates one in-app notification and an audit event.

The dashboard can display the report from January 1. PDF files are rendered on demand for the authenticated owner and are not placed in public storage. A configured, opted-in transactional email service can send an additional generic notice; delivery by email is not guaranteed by this feature.

## Consent and social sharing

Private by default. A member may download a branded two-page PDF, use the browser's Share menu for aggregate text, prepare a file for the native PDF share sheet, or copy a summary. A separate unchecked consent control is required before publishing one predefined achievement post per year to the verified Connect Feed. Feed posts contain aggregate metrics only, respect the community publishing feature flag and can be hidden later. Nothing is posted automatically.

## Verification and operations

- Check the annual job and runtime history in cron.job and cron.job_run_details.
- Check public.ccx_annual_recaps for one snapshot per eligible member/year.
- Check public.ccx_annual_recap_events for generated, pdf_exported, feed_shared and feed_hidden audit entries.
- Test all six roles, blank years, large counts, long names, PDF layout and the PDF share sheet.
- Test JWT denial, cross-user isolation, banned/suspended users, expired accounts, user consent, idempotent retries and feed hiding.
- Run node --test tests/annual-recap*.test.mjs plus the main GitHub Actions quality gate.
- The first real January load and delivery must receive operational monitoring and account acceptance before declaring the workflow fully production proven.

The data is subject to approved privacy and retention policies; this feature does not override deletion rights or legal preservation requirements.

## Technology

Uses the existing open-source pdf-lib PDF library. All artwork, copy and presentation are independently branded for Content Connect X; no third-party recap templates or proprietary assets are copied.
