"""One-use, hash-checked recovery of the interrupted Host Connect edit.
Only complete records with matching before/after SHA256 are applied.
The workflow validates the generated source and then removes these recovery files.
"""
from pathlib import Path
import base64,hashlib,json,re,zlib
root=Path('.')
parts=[root/'.maintenance'/f'host-refresh-data-{index}.b64' for index in range(3)]
encoded=''.join(path.read_text().strip() for path in parts)
text=zlib.decompressobj().decompress(base64.b64decode(encoded)).decode()
decoder=json.JSONDecoder(); pos=1; records=[]
# The final archived record was interrupted. Recover only the 23 independently
# checked complete records; never execute or interpret the incomplete remainder.
for _ in range(23):
    record,pos=decoder.raw_decode(text,pos);records.append(record)
    while pos<len(text) and text[pos] in ', \n':pos+=1
staged=[]
for name,before_hash,after_hash,edits in records:
    path=Path(name)
    if path.is_absolute() or '..' in path.parts or path.parts[0] not in {'src','supabase','scripts','docs'}:
        raise RuntimeError('Invalid source path')
    old=path.read_text() if path.exists() else ''
    if hashlib.sha256(old.encode()).hexdigest()!=before_hash:raise RuntimeError('Source changed: '+name)
    lines=old.splitlines(keepends=True)
    for start,end,value in reversed(edits):lines[start:end]=[value]
    new=''.join(lines)
    if hashlib.sha256(new.encode()).hexdigest()!=after_hash:raise RuntimeError('Recovered hash mismatch: '+name)
    staged.append((path,new))
for path,new in staged:
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(new)
shared=(root/'supabase/functions/_shared/providerConfig.mjs').read_text()
keys=set(re.findall(r'\b([A-Z][A-Z_]+):',shared))
for path in (root/'supabase/functions').rglob('*.ts'):
    source=path.read_text();old=source
    for key in keys:
        source=re.sub(r"Deno\.env\.get\(['\"]"+key+r"['\"]\)","optionalProviderSetting('"+key+"')",source)
    if source!=old and 'import {optionalProviderSetting}' not in source:
        source="import {optionalProviderSetting} from './providerConfig.mjs';\n"+source
    if 'optionalProviderSetting(' in source:(path.parent/'providerConfig.mjs').write_text(shared)
    if source!=old:path.write_text(source)
(root/'supabase/functions/stripe-webhook/index.ts').write_text("/** Retired membership webhook. Never accepts or fabricates payment events. */\nDeno.serve(()=>Response.json({error:'Legacy membership webhook retired.'},{status:410}));\n")
p=root/'supabase/functions/hosting-operations/index.ts';s=p.read_text()
a=s.index(" case 'provider_readiness':{");b=s.index(" case 'host_status':{",a)
s=s[:a]+''' case 'provider_readiness':{
  const ccbill=['CCBILL_CLIENT_ACCNUM','CCBILL_CLIENT_SUBACC','CCBILL_FLEX_ID','CCBILL_SALT']
   .every(name=>Boolean(Deno.env.get(name))) && Boolean(optionalProviderSetting('CCBILL_BOOKING_PERIOD_DAYS')) &&
   ['CCBILL_HOSTING_APPROVED','CCBILL_DYNAMIC_PRICING_APPROVED','CCBILL_FLEXFORM_LIVE_APPROVED',
    'HOSTING_FINANCIAL_RELEASE_APPROVED','HOSTING_PROVIDER_CALLBACK_RECONCILED','CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED']
   .every(name=>optionalProviderSetting(name)==='true');
  return response({merchant:{configured:ccbill,name:'CCBill',checkout_available:ccbill,
   external_capture_verified:false,note:'Presence and release checks only; actual provider acceptance and settlement must be verified.'},
   docusign:{configured:['DOCUSIGN_ACCOUNT_ID','DOCUSIGN_INTEGRATION_KEY','DOCUSIGN_USER_ID',
    'DOCUSIGN_PRIVATE_KEY','DOCUSIGN_CONNECT_HMAC_SECRET','DOCUSIGN_LOCATION_TEMPLATE_ID']
    .every(name=>Boolean(Deno.env.get(name)))&&optionalProviderSetting('DOCUSIGN_ADULT_BUSINESS_APPROVED')==='true',
    note:'Formal signature requires OAuth and independently verified completion'},
   notifications:{email_ready:optionalProviderSetting('HOSTING_EMAIL_PROVIDER_ENABLED')==='true'&&
    Boolean(optionalProviderSetting('HOSTING_EMAIL_API_URL')&&optionalProviderSetting('HOSTING_EMAIL_FROM')&&Deno.env.get('HOSTING_EMAIL_API_TOKEN')),
    push_ready:optionalProviderSetting('HOSTING_PUSH_PROVIDER_ENABLED')==='true'&&
    Boolean(Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')&&Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')&&optionalProviderSetting('WEB_PUSH_SUBJECT'))}});
 }
'''+s[b:];p.write_text(s)
p=root/'supabase/functions/integration-health/providerChecks.mjs';s=p.read_text()
a=s.index('  background_screening:');b=s.index('\n});',a)
s=s[:a]+'''  background_screening:{required:[],approvals:[],unavailable:true,
    note:'Optional provider integration is not implemented. No invented endpoint/key is required.'},
  health_clearance:{required:[],approvals:[],unavailable:true,
    note:'Private review and the existing PASS partner workflow remain separate; no unused generic provider keys are required.'}
'''+s[b:]
s=s.replace('return {configured:missing.length===0,missing,note:spec.note,','return {configured:!spec.unavailable&&missing.length===0,missing,note:spec.note,')
p.write_text(s)
p=root/'supabase/functions/integration-health/index.ts';s=p.read_text()
s=s.replace('import {createClient}',"import {OPTIONAL_PROVIDER_SETTINGS,optionalProviderSetting} from './providerConfig.mjs';\nimport {createClient}")
s=s.replace("keys.map(key=>[key,Deno.env.get(key)||''])","keys.map(key=>[key,Object.prototype.hasOwnProperty.call(OPTIONAL_PROVIDER_SETTINGS,key)?optionalProviderSetting(key):(Deno.env.get(key)||'')])")
p.write_text(s);(p.parent/'providerConfig.mjs').write_text(shared)
p=root/'.github/workflows/frontend-quality.yml';s=p.read_text()
needle='      - name: Yoti integration trust boundaries\n'
assert needle in s
s=s.replace(needle,'      - name: Host refresh and private gallery authorization\n        run: node --test tests/host-refresh.test.mjs tests/hosting-discovery-runtime.test.mjs\n'+needle)
p.write_text(s)
report='''# Host Connect refresh validation — November 17, 2026

## Delivered
- Native modal editors for New Space and saved default rules, with focus containment, Escape, focus return and background scroll locking.
- Equal-height desktop action/portfolio cards. The action card contains New Space, Set Default Rules and View Local Market. Photo-first portfolio carousel and per-card photo navigation.
- Shared photo-first property cards and a five-photo mosaic/full gallery for Content Connect X Properties.
- Multiple-file and drag/drop photo selection; paginated owner/guest galleries without a fixed 20-photo cap. Per-file 10MB, storage quotas and independent media approval remain enforced.
- Authenticated city/bounds market search below booking requests, own-property markers and approved approximate public area centers. No exact address disclosure or scraped third-party prices.
- Retired unused membership payment endpoint references, duplicate merchant diagnostics, and separated optional non-secret configuration defaults from actual provider credentials. Supabase-managed secrets and existing Yoti/PASS data remain untouched.

## Evidence
Local Chromium fixture tests were executed at 1440px and 390px: modal opening and Escape, viewport fit, background scroll lock, property-carousel navigation, multi-select, 25-image selection, default-rule save, and city search passed with no page JavaScript errors. Desktop side-card heights matched. Test images/listings were local fixtures; no demonstration property was inserted into the real database.

Six source/configuration regressions and seven executable API authorization tests cover fail-closed provider approvals, retired endpoints, credential preservation, photo selection beyond twenty, owner/guest media boundaries, expired property authority, rejected unauthorized upload paths, paginated media and market result privacy. API tests use an in-memory database, not an authenticated production account.

Full lint, application typecheck, build, hosting policy tests, Yoti trust tests, readiness checks, release guards and frontend/backend import/action contracts pass locally. CI reruns these before committing recovered source. Provider sandbox acceptance, real authenticated host/guest bookings and production financial operations are NOT certified by these tests. Existing dependency-audit findings are not suppressed.

## Configuration and deployment
See SUPABASE_CONFIGURATION_INVENTORY.md for exact remaining names and optional defaults. Re-sync/rebuild Bolt to refresh source-based missing-variable prompts; a cached editor notification cannot be cleared from GitHub. Deploy the new hosting-discovery function with the updated frontend. The relevant existing provider functions retain the original Supabase environment override names and remain disabled until their real credentials and approvals are configured.
'''
(root/'docs/HOST_CONNECT_REFRESH_VALIDATION.md').write_text(report)
print('Recovered and validated hashes for',len(staged),'source files; provider refactor completed. No secret values were read.')
