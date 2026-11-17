# Content Connect X: account entry and optional two-factor authentication

Effective November 17, 2026. This policy supersedes older descriptions of per-feature age or mandatory administrator MFA in historical runbooks.

## Signup flow

Email registration creates an authenticated account with non-administrator security defaults and an editable profile stub. The next screen is independent age verification, not a required professional-profile questionnaire. Only a trusted, approved verification result creates a `member_admissions` record. The account stays at `/Verification` until that record exists; logout/login, refresh, browser metadata and direct feature requests cannot skip it. Email confirmation still applies when enabled by Supabase Auth.

Completed signup admission is durable. The same server-owned record grants access to enabled features without repeatedly checking verification expiry. Current independent evidence remains separate and is used for truthful verification badges, not as a recurring feature lock. Suspension, record ownership, resource membership, consent, actual provider approval, and configured product/plan permissions remain enforced.

## Existing administrator

The migration preserves the existing unrestricted administrator's access with a one-time `legacy_admin` admission. It does not insert an approved verification, claim the administrator's age was independently reviewed, or give future accounts a bypass. Later role changes do not automatically create legacy admission.

## Optional MFA

Authenticator enrollment remains available in Account Security. No feature, database eligibility function, or administrative API demands AAL2. An authenticator that a member voluntarily enables still protects that member's sign-in; accounts without an enrolled authenticator are never asked to set one up. Authentication-status lookup failures show a retry screen, not a false MFA-enrollment requirement. Database administrator roles continue to protect privileged operations. Disabling mandatory MFA reduces account-takeover protection for privileged accounts; optional enrollment is retained.

## Implementation

- `member_admissions`: own-row SELECT only for authenticated users; no browser insert/update/delete grants. Service-owned approval trigger records entry completion.
- `ccx_bootstrap_signup`: safe defaults for new Auth accounts; does not trust `user_metadata` for admin or verification.
- `record_age_admission`: approval-only trigger; pending/rejected evidence cannot admit a new account.
- `ccx_member_feature_flags`, `ccx_workspace_allowed`, private chat and booking functions read admission instead of making a second age/MFA decision.
- Protected Edge entrypoints use the same admission records. Host-only property accounts retain their separate host-agreement access and do not gain creator access without signup admission.
- Authenticated administrator header places **Host Connect** immediately before **Membership**.

Migration: `supabase/migrations/20261117232051_one_time_signup_admission_optional_mfa.sql`.

## Validation

The live database was tested with two temporary users inside a transaction that was rolled back. All twelve checks passed: safe signup defaults, no automatic admission, onboarding-required feature decision, no forged admission insert, no bypass through the old global flag, no pending-review admission, approval-only admission, AAL1 feature access, durable completion, existing admin Friends access, truthful age evidence, and own-row RLS. No temporary user or approval was retained.

`tests/account-entry-runtime.test.mjs` executes the actual gateway handlers against in-memory fixtures. It covers Friends/admin operations without MFA, new-signup denial despite forged metadata, missing-admission query failures, anonymous/suspended accounts, independent-review restrictions, and retained feature switches. This is not a provider sandbox or real-user sign-in test.

Full local lint, frontend typecheck, 92 offline tests, frontend/backend contracts and static release invariants pass. The optional authenticated hosting suite requires genuine host/guest credentials and is not replaced by synthetic production approvals. Existing dependency audit findings are not suppressed.
