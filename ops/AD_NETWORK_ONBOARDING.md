# PPC & Affiliate Partner Onboarding — Content Connect X

**Status: integration-ready placements only. No external provider account was registered or activated in this release.**

## Current implementation

The logged-in dashboard reserves a right-side **Sponsored** column. Its `SponsorshipSlot` can display up to three approved text-only campaigns registered in `public.ccx_sponsorship_campaigns`, with distinct sponsors, links, date windows and paid/affiliate disclosures. When none are approved and active, it shows no fictional advertisement. External links use `rel="sponsored nofollow noopener noreferrer"` and `referrerPolicy="no-referrer"`. No provider JavaScript, tracking pixels, third-party iframes or customer targeting cookies are installed.

Existing campaign approval and validity are independently enforced in the Supabase RLS policy and the client query. This generic placement can serve an approved affiliate link or advertiser landing page, but does **not** establish CPC billing, paid clicks, ad network eligibility or revenue.

## Required before an external ad network or affiliate is enabled

1. Recover the user's original uploaded provider list or have the user supply **exact website names and URLs**. Those details could not be verified from the materials accessible in this task, so no provider names or programs are inferred.
2. The operator must register in each provider's actual sign-up flow, accept the network/affiliate contractual terms, verify a contact email, confirm website ownership and complete any tax/banking/payout documentation required. **Never provide account passwords, recovery codes or one-time codes in GitHub, chat or source code.** Use the provider's secure sign-in flow or Work browser mode if available and explicitly authorized.
3. Confirm terms for professional adult-industry websites and the provider's content policy, geography, age-gating, consent, ad creative restrictions, disallowed destinations, CPC/affiliate attribution terms, payout thresholds and reporting.
4. Submit each text creative, external destination and campaign duration to platform moderation. Do not auto-approve. Store provider credentials and webhook secrets only in a protected Supabase secret manager or approved vault, never in public Bolt environment variables or client-side JavaScript.
5. Evaluate any tracking or cookie proposal with legal/privacy approval. Avoid targeting members by private-group membership, sexual orientation, race/ethnicity, fetish interests, health/testing records, private location or ID data. Prefer contextual placement and coarse, aggregate reporting.
6. Only after external network acceptance and privacy review, implement provider-specific signed postback/click attribution, fraud prevention, reconciliation and takedown handling. Do not treat a redirected link as proof of an actual paid click or commission.
7. Test approved campaigns, expired campaigns, blocked destinations, empty inventory, ad blockers, mobile widths, keyboard access, external-link protections, and removal/rollback. Verify actual provider reports before making any earnings claim.

## What remains a user/operator action

The user must identify the specific previously mentioned PPC and affiliate companies and complete any signup, ownership and payment compliance requirements. The current account's password is neither accessible nor needed in source code. After that, provider integrations can be built one network at a time with auditable approval gates.

**Never publish, generate or simulate live ads just to fill unused space.** Inactive inventory stays blank and the website remains on Bolt.


## Verified Gamma Entertainment provider discovery (November 19, 2026)

Programs requested: FameDollars (https://www.famedollars.com/), BlazingBucks (https://www.blazingbucks.com/), and BuddyProfits (https://www.buddyprofits.com/), all under Gamma Entertainment's GammaStats umbrella. Gamma's official landing page states that one account can promote all three. The common registration form requires a username, password, website title and URL, contact name/email/telephone, mailing/payment information, payout method, acceptance of terms, and any subsequent identity or payment verification. These are not available to this release and must not be fabricated. **Use only the provider's secure signup page for password entry.** No password was stored, copied, or submitted by these code changes. If any previously shared password is in reuse, change it before enrolling.

After approval, enter each network's actual tracked referral/deep link into an independently reviewed `ccx_sponsorship_campaigns` campaign with its exact disclosure and expiration. Merely linking to a program's homepage does not create attributable affiliate revenue. No PPC impression or commission should be claimed without the provider's report.
