/** Administrator-only API key control panel. All credential values travel directly to a trusted Edge Function / encrypted Vault. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,KeyRound,Eye,EyeOff,RefreshCw,PlugZap,AlertTriangle} from 'lucide-react';
import {integrationAction} from './integrationApi';
const styles={panel:'ccx-surface p-5',input:'w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm text-[var(--cc-text-primary)] focus:ring-2 focus:ring-[var(--cc-focus)]',button:'ccx-action-primary rounded-xl px-4 py-2.5 text-sm'};
const launchProviders=new Set(['ccbill','docusign']);
const names={pass:'PASS — Performer work clearance',ccbill:'CCBill — Payments',docusign:'DocuSign — Releases',email:'Transactional email',webpush:'Browser notifications',maps:'Location maps',openmoderate:'Media moderation',sentry:'Error monitoring',flagsmith:'Feature flags'};
const help={pass:'PASS maintains 14-day yes/no work clearance. Store an approved partner credential here once PASS grants access; automatic status and production-hold checks remain disabled until the official API contract is received, mapped and tested. Never expose clinical results.',
ccbill:'Keys are encrypted, but financial captures stay blocked until the approved merchant integration and callback contract are verified.',
docusign:'Credentials here are saved securely; the current signing integration still requires its service account and approved template setup.',
email:'Use a verified sender domain with Resend. Individual account emails require member opt-in; generic notifications are delivered through a durable private queue with retries.',
webpush:'Browser VAPID public keys also need public client configuration; private keys remain server-side.',
maps:'Map tiles can use a public browser token; routing keys belong on the server.',
openmoderate:'Scanning workers still need verified provider deployment and human review.',
sentry:'Hosted Sentry DSN enables redacted React errors only for members who opt into diagnostics. No replay, traces, or sensitive user content is collected.',
flagsmith:'Remote flags require environment and rollout verification.'};
export default function IntegrationSettings(){
 const [providers,setProviders]=useState([]),[values,setValues]=useState({}),[visible,setVisible]=useState({}),[agreements,setAgreements]=useState({});
 const [showOptional,setShowOptional]=useState(false);
 const [prepaidLimit,setPrepaidLimit]=useState(''),[prepaidReviewed,setPrepaidReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async(includeOptional=showOptional)=>{
  setBusy(true);setError('');
  try{const r=await integrationAction('admin_list',{include_optional:includeOptional===true});setProviders((r.providers||[]).filter(p=>p.provider!=='yoti'));}catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 useEffect(()=>{void load();},[]);
 const secret=async(provider,name)=>{
  const value=values[name]||'';
  if(value.trim().length<4)return setError('Enter a valid credential to store.');
  setBusy(true);setError('');setNotice('');
  try{
   await integrationAction('admin_set_secret',{provider,name,secret:value});
   setValues(v=>({...v,[name]:''}));setNotice('Encrypted credential stored. Nothing was written to browser storage.');
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const savePrepaid=async(disable=false)=>{
  const cents=disable?0:Math.round(Number(prepaidLimit)*100);
  if(!disable&&(!prepaidReviewed||!Number.isSafeInteger(cents)||cents<300||cents>1000000))return setError('Enter the actual merchant-approved maximum in USD and confirm the prepaid terms.');
  setBusy(true);setError('');setNotice('');
  try{
   await integrationAction('admin_membership_prepaid',{max_cents:cents,provider_contract_reviewed:prepaidReviewed});
   setPrepaidLimit('');setPrepaidReviewed(false);
   setNotice(disable?'Prepaid checkout disabled. Existing paid terms are unchanged.':'Approved prepaid transaction limit saved.');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const toggle=async(provider,enabled)=>{
  if(enabled&&!agreements[provider])return setError('Confirm the provider contract, privacy policy and supported use before enabling.');
  setBusy(true);setError('');setNotice('');
  try{const r=await integrationAction('admin_provider_settings',{provider,enabled,
    provider_contract_reviewed:Boolean(agreements[provider])});
   setNotice(r.note||'Setting saved.');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <div className="space-y-5">
  <header className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">API & integration settings</h2>
   <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">Connect CCBill and DocuSign here. Other integrations can be configured later, only if you choose to use them. Credentials are encrypted in Supabase Vault; changes require administrator MFA.</p></div>
   <button onClick={()=>void load()} disabled={busy} className="ccx-secondary rounded-xl p-3" aria-label="Refresh provider status"><RefreshCw size={19}/></button>
  </header>
  <div className="ccx-surface flex items-start gap-3 p-4">
   <ShieldCheck className="mt-0.5 shrink-0 text-[var(--cc-link)]" size={21}/>
   <p className="text-sm text-[var(--cc-text-secondary)]">Credentials present does not mean a provider is approved or live. Government ID and live-selfie processing use our first-party Railway worker. PASS work clearance requires a separate approved partner agreement. Payment and health workflows remain protected by server-side release gates.</p>
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <section className="ccx-surface space-y-2 p-5" aria-label="First-party age and identity verification">
   <h3 className="font-semibold">First-party age and identity verification · Railway</h3>
   <p className="text-sm text-[var(--cc-text-secondary)]">The built-in system uses government ID capture, independently checked document fields, an ID portrait-to-live-selfie match, age eligibility, and a guided liveness challenge. Records are private in Supabase; the dedicated Railway service processes them.</p>
   <p className="text-xs text-[var(--cc-text-secondary)]">This does not require Yoti, another paid age-verification vendor, or a new provider API key. Production activation is controlled independently by the verified identity configuration and evidence-handling requirements.</p>
   <a className="inline-flex items-center rounded-lg border border-[var(--cc-border)] px-3 py-2 text-sm" href="/Verification">Open first-party verification</a>
  </section>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h3 className="font-semibold">Launch provider connections</h3>
   <button type="button" aria-expanded={showOptional} className="ccx-secondary rounded-xl px-4 py-2 text-sm" onClick={()=>{const next=!showOptional;setShowOptional(next);if(next)void load(true);}}>{showOptional?'Hide optional services':'Configure optional services'}</button>
  </div>
  {showOptional&&<p className="text-sm text-[var(--cc-text-secondary)]">Optional services remain inactive without their own provider credentials. They are not required to deploy the core platform.</p>}
  <div className="grid gap-4 lg:grid-cols-2">
   {providers.filter(p=>launchProviders.has(p.provider)||showOptional).map(p=><article key={p.provider} className={styles.panel+' space-y-3'}>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h3 className="flex gap-2 items-center font-semibold"><PlugZap size={17} className="text-[var(--cc-link)]"/>{names[p.provider]||p.provider}</h3>
      <p className="mt-2 text-xs text-[var(--cc-text-secondary)]">{help[p.provider]}</p></div>
     <span className={'rounded-full px-2 py-1 text-xs '+(p.enabled?'bg-emerald-50 text-emerald-800':'bg-[var(--cc-surface)] text-[var(--cc-text-secondary)]')}>{p.enabled?'Enabled':launchProviders.has(p.provider)?'Awaiting connection':'Optional · not connected'}</span>
    </div>
    <div className="space-y-3">
     {(p.fields||[]).map(field=><div key={field.name}>
      <label className="block text-xs font-semibold text-[var(--cc-text-secondary)]" htmlFor={'ccx-'+field.name}>{field.name.replaceAll('_',' ')} · {field.configured?'Stored':'Missing'}</label>
      <div className="ccx-action-row mt-1 flex gap-2">
       <input id={'ccx-'+field.name} className={styles.input+' min-w-0 flex-1'} autoComplete="off" spellCheck={false}
        type={visible[field.name]?'text':'password'} placeholder={field.configured?'Replace saved credential':'Paste provider API credential'}
        value={values[field.name]||''} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}/>
       <button className="ccx-secondary rounded-xl px-3" aria-label={visible[field.name]?'Hide':'Show'} onClick={()=>setVisible(v=>({...v,[field.name]:!v[field.name]}))}>{visible[field.name]?<EyeOff size={17}/>:<Eye size={17}/>}</button>
       <button className={styles.button} onClick={()=>secret(p.provider,field.name)} disabled={busy||!(values[field.name]||'').trim()}><KeyRound size={16} className="inline mr-1"/>Save</button>
      </div>
     </div>)}
    </div>
    {p.provider==='ccbill'&&<section className="space-y-2 border-t border-[var(--cc-border)] pt-3" aria-label="Prepaid membership merchant approval">
     <h4 className="font-semibold">Six-month and annual memberships</h4>
     <p className="text-xs text-[var(--cc-text-secondary)]">One-time FlexForms payments, 180/365 days. No additional API key. Confirm that CCBill has approved the same form for single billing and the maximum transaction amount, then test both terms and their authenticated callbacks before enabling.</p>
     <p className="text-xs font-semibold">{p.membership_prepaid_max_cents>0?'Approved limit: $'+(p.membership_prepaid_max_cents/100).toFixed(2):'Prepaid checkout disabled pending merchant acceptance'}</p>
     <label className="block text-xs font-semibold">Approved one-time charge maximum (USD)<input type="number" min="3" max="10000" step="0.01" className={styles.input+' mt-1'} value={prepaidLimit} onChange={e=>setPrepaidLimit(e.target.value)}/></label>
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={prepaidReviewed} onChange={e=>setPrepaidReviewed(e.target.checked)}/>I confirmed the merchant contract, one-time 180/365-day pricing and authenticated test callbacks for the approved maximum.</label>
     <div className="flex flex-wrap gap-2"><button type="button" className="ccx-secondary rounded-xl px-3 py-2 text-sm" disabled={busy||!p.enabled||!prepaidReviewed||!prepaidLimit} onClick={()=>void savePrepaid()}>Save prepaid approval</button>
      {p.membership_prepaid_max_cents>0&&<button type="button" className="ccx-secondary rounded-xl px-3 py-2 text-sm" disabled={busy} onClick={()=>void savePrepaid(true)}>Disable prepaid checkout</button>}</div>
    </section>}
    <div className="border-t border-[var(--cc-border)] pt-3">
     <label className="flex items-start gap-2 text-xs text-[var(--cc-text-secondary)]"><input type="checkbox" className="mt-1" checked={Boolean(agreements[p.provider])}
      onChange={e=>setAgreements(v=>({...v,[p.provider]:e.target.checked}))}/>
      I have reviewed the provider's actual contract, permitted use, data-handling terms and necessary credentials.</label>
     <button className="ccx-secondary mt-3 rounded-xl px-4 py-2 text-sm" disabled={busy||p.provider==='pass'||p.enabled===false&&!agreements[p.provider]}
      onClick={()=>toggle(p.provider,!p.enabled)}>{p.enabled?'Disable integration':'Enable configured integration'}</button>
     {p.provider==='pass'&&<p className="mt-2 text-xs text-amber-800"><AlertTriangle size={13} className="inline mr-1"/>Awaiting official PASS partner API and production-hold specification. Request integration details from info@passcertified.org. Until an approved integration is tested, check the official PASS database directly.</p>}
    </div>
   </article>)}
  </div>
 </div>;
}
