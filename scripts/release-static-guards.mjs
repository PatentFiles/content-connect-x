/**
 * Fail CI when launch-blocking invariants regress. This is a static gate, NOT
 * an authenticated integration test, legal approval, or a live payment test.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const mandatory=[
 'src/supabase/HostingMarketplace.jsx',
 'src/supabase/HostingAreaMap.jsx',
 'src/supabase/HostingBookingOperations.jsx',
 'supabase/functions/hosting-advanced/index.ts',
 'supabase/functions/hosting-marketplace/index.ts',
 'supabase/functions/hosting-operations/index.ts',
 'supabase/functions/hosting-ccbill/index.ts',
 'supabase/functions/hosting-ccbill-webhook/index.ts',
 'supabase/functions/hosting-docusign-webhook/index.ts',
 'supabase/HOSTING_PRODUCTION_READINESS.md'
];
for(const path of mandatory) assert.ok(existsSync(path),'Missing required release file: '+path);
const checkout=read('supabase/functions/hosting-ccbill/ccbill.ts');
const callback=read('supabase/functions/hosting-ccbill-webhook/index.ts');
assert.match(checkout,/HOSTING_FINANCIAL_RELEASE_APPROVED/);
assert.match(checkout,/HOSTING_PROVIDER_CALLBACK_RECONCILED/);
assert.match(callback,/CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED/);
assert.match(callback,/verifyPurchaseDigest/);
const booking=read('supabase/functions/hosting-marketplace/index.ts');
assert.match(booking,/Use the transactional dynamic-pricing reservation workflow/);
assert.match(booking,/Use the booking cancellation-policy workflow/);
assert.match(booking,/signed and funded|Completed rental agreement and confirmed payment/i);
const pricing=read('supabase/functions/hosting-advanced/index.ts');
assert.match(pricing,/ccx_hosting_reserve/);
assert.match(pricing,/ccx_hosting_price_quote/);
const docusign=read('supabase/functions/hosting-docusign-webhook/index.ts');
assert.match(docusign,/x-docusign-signature/);
assert.match(docusign,/certificate_path/);
const calendar=read('supabase/functions/hosting-calendar/index.ts');
assert.match(calendar,/revoked_at/);
assert.match(calendar,/redirect:'error'/);
assert.doesNotMatch(read('package.json'),/base44/i);
const frontend=read('src/supabase/HostingMarketplace.jsx');
assert.match(frontend,/HostingAreaMap/);
assert.match(frontend,/hostingAdvanced\('reserve'/);
const release=read('supabase/HOSTING_PRODUCTION_READINESS.md');
assert.match(release,/NOT APPROVED/);
assert.match(release,/zero|0 Supabase Auth users|no independently verified/i);
const directories=['supabase/functions/hosting-advanced','supabase/functions/hosting-production',
 'supabase/functions/hosting-calendar','supabase/functions/hosting-marketplace'];
for(const dir of directories)assert.ok(readdirSync(dir).includes('index.ts'),'Missing Edge entrypoint: '+dir);
process.stdout.write('PASS Enterprise static release guards (source invariants only)\n');
