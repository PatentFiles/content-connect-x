# Trust footer and personal dashboard release

## Architecture and what changed

This supplements the current Supabase README; the April 2026 uploaded Base44 document is historical, not evidence that every described service is operational.

- Missing dashboard preferences now render an empty layout. Existing rows are not reset. The fixed catalog has 15 metric/tool modules and six optional people modules. Per-role rules and optimistic revisions remain enforced by the original dashboard RPC.
- People modules use the existing authenticated directory endpoint. It checks admissions, bans/suspensions, blocks, flags and profile completeness before issuing signed avatars. The modal rechecks access and obtains shared social links through the existing membership-protected endpoint. No private gallery, health record or identity evidence is exposed.
- Featured means available complete directory profiles, currently alphabetical. It is not a paid placement, popularity ranking, safety guarantee or fabricated rating. Near me requires the member's city and country and uses the existing city filter; it is not a measured distance or GPS tracker.
- The white workspace receives subtle slate surfaces, borders and restrained blue accents. Public artwork and the established dark/neon marketing CSS remain unchanged.
- `/trust/*` pages and the global footer are public. Public routing does not admit a user to the workspace. Host Connect routing remains separate.
- Cookie preferences default optional diagnostics and UI experiments off. The two optional SDKs initialize only after device-level opt-in. Saving/withdrawing reloads the app to unload previous SDK instances. Necessary authentication storage is separate. No ad SDK, pixel or orientation-based profiling is introduced.

## Reporting boundaries

`ccx_trust_settings` starts with `intake_enabled=false`. The database rejects submissions until legal entity, postal address, contact email, reviewed policies and reviewer coverage are confirmed. A frontend toggle cannot override this. No fabricated contact address is seeded. Draft pages show their unfinished status.

The anonymous `trust-intake` endpoint accepts bounded text only. It cannot read cases, return evidence, fetch submitted URLs, grant roles or disclose member records. It normalizes an allowlist, supports a request idempotency key, hashes a daily network-rate hint with a server HMAC key and uses a transactional hourly limiter. Raw IPs are not added to cases or application logs. Infrastructure access logs may still exist and require a separate retention review. Edge/WAF behavior and load-abuse resilience must be validated before activation; forwarded headers are not authentication.

All four trust tables have RLS and no browser table grants. Only the service role can execute the submit RPC. A public read routine returns only operator/public availability fields. The staff review RPC requires server-owned admin status, a non-restricted account, and JWT assurance level `aal2`. Queue views, individual case reads and status changes create audit events; event updates/deletes are blocked. Case material is not included in audit metadata.

The NCII queue sets a conservative 48-hour target from receipt. This does not determine whether a request is legally valid, execute a takedown, find identical copies, notify a reporter, submit a NCMEC report or establish wrongdoing. Internal review is a staff inbox, NOT a law-enforcement access portal. No outside agency is given database credentials or standing real-time access.

## Hard launch blockers — not solved by footer copy

1. Identify the legal operator, registered/service address and monitored contact channels; have qualified counsel approve final terms, privacy notices, recordkeeping applicability, sensitive-data notices and country-specific rights.
2. Name trained reviewers, establish urgent escalation/on-call coverage, email/pager delivery, deadline monitoring, actual content restriction/removal and duplicate handling, reasoned decisions and reporter updates/appeals. Confirm mandatory child-exploitation reporting obligations and a secure evidence-preservation runbook.
3. Define record-specific retention/deletion and legal holds. This release does not implement retention cleanup for case payloads. Do not activate intake before this and the notification/escalation plan are operational. Investigate logs and backups too.
4. Replace draft copy with final versioned documents, record effective date and required assent in onboarding. No new terms have silently been imposed on existing users.
5. Approve a jurisdiction allowlist and enforce it server-side/at the edge for protected services, while keeping safety reporting accessible. Blocking Asia/Middle East is a requested launch scope, not a religious classification or an assertion that those countries share a law. This release does not implement geofencing.
6. Obtain CCBill written merchant approval for the actual professional-collaboration/hosting business model. Confirm fees, reserves, chargebacks, statement descriptors, settlement, recurring billing and cancellation/refund rights; test authenticated webhooks and end-to-end billing before accepting payment.
7. For a future agency portal: independent officer verification, MFA, case-scoped lawful approval, international-transfer analysis, data minimization/redaction, signed expiring exports, access expiry, dual authorization for sensitive disclosure, and audited revocation. A government-looking email domain is not authorization. Never expose all users, private messages or clinical/identity records as a default compliance measure.

## Affiliate and advertising scope

No pornographic affiliate account, sex-toy storefront, ad creative, third-party pixel or tracking identifier has been created. No passwords supplied in chat are stored in source or used for account enrollment. No partnership or ProBiller relationship is claimed. A separate non-explicit professional sponsorship system may be added only with approved terms and visible disclosures; it must not infer sexual orientation or use sensitive profile/clinical fields.

The GDPR special-category prohibition in DSA Article 26(3) must be considered together with scope/exemptions (including Article 19); explicit consent does not automatically make such targeting lawful. Our safer product decision is not to implement it anywhere.

## Research checked on 2026-11-19

Primary references (legal applicability must be assessed for the actual product):
- FTC TAKE IT DOWN Act guidance: https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act — covered-platform public reporting and valid-request removal duties effective May 19, 2026.
- US provider reporting: https://uscode.house.gov/us/usc/119-124/t18/s2258A/ and https://www.missingkids.org/policy-advocacy/reporting-by-online-platforms.html
- EU DSA, including Articles 19 and 26: https://eur-lex.europa.eu/eli/reg/2022/2065
- EDPB Article 48 guidelines: https://www.edpb.europa.eu/documents/guideline/guidelines-022024-on-article-48-gdpr_en
- UK Ofcom age assurance: https://www.ofcom.org.uk/online-safety/protecting-children/enforcement-programme-to-protect-children-from-encountering-pornographic-content-through-the-use-of-age-assurance
- Canada privacy consent: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/
- Canada mandatory reporting (check provisions in force, not merely enacted amendments): https://laws-lois.justice.gc.ca/eng/acts/I-20.7/FullText.html
- Australia age-restricted material codes: https://www.esafety.gov.au/industry/codes/faq-access-to-online-porn-and-other-adult-content
- CCBill merchant pricing/structure: https://ccbill.com/pricing
- ProBiller public contact/operator description: https://www.probiller.com/contact-us/

Reference-site safety patterns reviewed: Aylo's public trust material and Fansly's public reporting guidance. Their descriptions of human review, commercial partners, tools or staffing are not copied into CCX as claims about our implementation. The user's supplied Aylo text is reference material, not CCX operational evidence.

## Release status and verification

The hosted migration tool generated versions 20261119141609 and 20261119141902; their SQL is retained under `supabase/migrations`. No saved dashboard row was reset. Public reporting starts closed. Automated test results and deployment status belong in the PR once actually observed, not predeclared here. Publishing the frontend in Bolt remains separate from a GitHub commit or merge. The private identity-verification pilot and its worker were not changed.
