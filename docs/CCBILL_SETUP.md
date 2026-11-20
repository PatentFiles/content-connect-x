# CCBill merchant configuration — Content Connect X / Host Connect

This is the current separate payment-provider setup. Age verification is processed by the first-party Railway identity service, not a payment company or external age-verification provider. Never commit or paste private credentials into GitHub or the website frontend.

## Configure CCBill

### 1. Apply for the correct merchant arrangement

Use CCBill's merchant application/sales channel. Accurately describe both products: (a) paid memberships for an adult-creator professional network, and (b) a marketplace for properties knowingly rented for adult-content production, involving independent hosts. Ask CCBill to confirm separately whether it approves rental payments, the merchant-of-record structure, any settlement to third-party hosts and refundable security deposits. Do not assume that adult subscription acceptance automatically covers a rental marketplace.

Prepare the legal entity, ownership/contact information, bank details, functional domain and identification/business documents requested for your jurisdiction. Publish reviewed terms, privacy, refund/cancellation and support information before underwriting completion. Do not send documents or keys to ChatGPT.

References: https://ccbill.com/merchants ; https://ccbill.com/industries/adult-business ; https://ccbill.com/doc/acceptable-identification-for-accounts

### 2. Separate subscriptions from rentals

After approval, obtain your six-digit main account number. Ask Merchant Support to create/confirm the four-digit subaccount for recurring memberships, with USD Dynamic Pricing enabled. Keep leading zeroes. A separately approved rental subaccount should not be treated as the membership subaccount.

Ask Support for the **Dynamic Pricing encryption key/salt**, current permitted recurring periods, approved payment methods and the timezone used for webhook timestamps/dates. This version accepts recurring 30-day USD terms only. Confirm how `nextRenewalDate` defines the paid-through boundary in your account; current code interprets a date-only field at midnight in the explicitly configured merchant timezone. Sandbox acceptance must validate that boundary before release.

Reference: https://ccbill.com/doc/dynamic-pricing-user-guide

### 3. Create and test the hosted FlexForms flow

In Admin Portal, open FlexForms Systems and create a payment flow and form for memberships. Enable Dynamic Prices in the form pricing setup. Save/test the flow, then use the Promote to Live process only when Merchant Support and your acceptance tests approve it. Copy the **live Flex ID**, not a preview URL. Success/cancel destinations can return to `https://contentconnectx.com/Membership`; returning to this URL never grants paid access.

The application generates signed pricing links itself. Do not paste a fixed-price generic payment link into the frontend. This hosted-form implementation does **not** require your application to collect cards or use the REST card-token API.

Reference: https://ccbill.com/doc/flexforms-quick-start-guide

### 4. Deploy the authenticated webhook relay

**This is an application-specific security requirement, not a CCBill native HMAC feature.** CCBill's Dynamic Pricing approval digest does not authenticate every webhook field. The included Cloudflare Worker verifies CCBill's published source ranges at Cloudflare's edge, then signs the complete body, query and product scope for the Supabase receiver.

Create a Cloudflare Workers service from `deploy/ccbill-relay/worker.mjs` using the provided `wrangler.toml` (or its dashboard editor). Keep it as a direct Cloudflare Worker endpoint, not a generic proxy that trusts user-provided IP headers. Use a workers.dev URL or your own controlled subdomain. Ask your administrator to confirm account cost and deployment access before provisioning paid services.

Set Worker variable `SUPABASE_ORIGIN=https://yxuqbygykpfbioslljlf.supabase.co`.
Generate a random secret of at least 32 characters and save it as encrypted Worker secret `CCBILL_WEBHOOK_RELAY_SECRET`. Put the **same** value in Supabase Edge Function Secrets. A password manager or `openssl rand -hex 32` can generate it; do not use a sample key. The Worker requires real Cloudflare request metadata and must reject non-CCBill sources. No Supabase service key goes in the Worker.

The two Worker routes are:
- `https://YOUR-WORKER-HOST/membership`
- `https://YOUR-WORKER-HOST/rental`

These forward to the following existing project endpoints, respectively:
- `https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/membership-ccbill-webhook`
- `https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/hosting-ccbill-webhook`

**Configure CCBill to call the Worker, not the Supabase endpoint directly.** The direct endpoints deliberately reject unsigned events. The relay is not deployed to your Cloudflare account by this change.

References: https://ccbill.com/doc/webhooks-user-guide ; https://developers.cloudflare.com/fundamentals/reference/http-headers/

### 5. Register webhooks on the correct subaccount

In CCBill Admin Portal, select the membership subaccount, open **Webhooks**, add the Worker `/membership` URL, choose **URL Encoded** (or JSON only after confirming identifiers are strings), select the nearest supported satellite and save. Use the current event versions and preserve leading zeroes and long identifiers; numeric JSON IDs are intentionally rejected to prevent precision loss.

Subscribe to the implemented membership events: `NewSaleSuccess`, `NewSaleFailure`, `RenewalSuccess`, `RenewalFailure`, `Cancellation`, `Expiration`, `Refund`, `Chargeback`, `Void`, `Return`. Confirm that custom `X-ccx_membership` passthrough values reach the initial-sale callback. The exact account, subaccount, amount, currency and paid-through date are checked before an entitlement changes.

For a separately approved rental integration, use `/rental`, with `X-ccx_booking` passthrough. This version processes successful rental sale capture only; other rental finance events require a complete reconciliation/refund workflow and are not silently recorded as successful. Do not launch rentals on the assumption that the membership event processor manages host payouts or deposit release.

References: https://ccbill.com/doc/newsalesuccess ; https://ccbill.com/doc/renewalsuccess-rebill ; https://ccbill.com/doc/cancellation ; https://ccbill.com/doc/expiration

### 6. Enter the membership values in Supabase

Use the active project's Edge Functions > Secrets. Keep Supabase's existing managed secrets unchanged. These values are read server-side only:

| Name | Value/source |
|---|---|
| `CCBILL_CLIENT_ACCNUM` | Six-digit merchant account number. |
| `CCBILL_MEMBERSHIP_SUBACC` | Approved four-digit membership subaccount. |
| `CCBILL_MEMBERSHIP_FLEX_ID` | Live recurring-membership Flex ID. |
| `CCBILL_MEMBERSHIP_SALT` | Membership Dynamic Pricing encryption key/salt. |
| `CCBILL_EVENT_TIMEZONE` | IANA timezone explicitly confirmed with CCBill; not automatically your browser's timezone. |
| `CCBILL_WEBHOOK_RELAY_SECRET` | Same private random value configured in the relay. |
| `CCBILL_MEMBERSHIP_APPROVED` | `true` only after specific merchant/product/Dynamic Pricing approval. |
| `CCBILL_MEMBERSHIP_LIVE_APPROVED` | `true` only after live form and end-to-end acceptance authorization. |

The existing provider registry also requires `ccx_integrations.provider='ccbill'` to have `enabled=true`. Use the existing administrator provider settings or an authorized SQL update **after** configuration and testing. No step above automatically proves underwriting approval. Do not enable the flag merely to remove a warning.

No new Stripe keys are required. The membership integration does not reuse the legacy rental `CCBILL_CLIENT_SUBACC`, `CCBILL_FLEX_ID` or `CCBILL_SALT` values unless CCBill explicitly approves the same arrangement; the code intentionally uses separate names.

### 7. Perform CCBill acceptance tests before charging customers

With CCBill's approved testing process, verify a sale and renewal, declined initial purchase and rebill, cancellation with paid-period retention, expiration, refund/chargeback, duplicate delivery, changed amount/currency and callbacks arriving out of order. Check that a browser return without a payment event never upgrades a user. Check that a pending or duplicate subscription cannot create a second charge through your normal UI. Financial events marked `reconciliation_required` must be investigated from the processor's records; do not ask the customer to pay again blindly.

The setup below is code-tested, not a real CCBill account acceptance certificate. Your merchant dashboard and keys were not accessed, and no real charge/refund/cancellation was performed.


## Payment scope and release

Membership and Host Connect rental payments are distinct. Keep the existing protected webhook relay, merchant-specific account checks, idempotent event processing and separately approved funds flow. CCBill must approve the use case, callbacks and pricing in each merchant environment before transactions are represented as live. Host payouts, refunds, escrow, and tax obligations are separate operational processes.

