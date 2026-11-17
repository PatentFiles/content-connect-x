/** MFA-only API key control panel. All credential values travel directly to a trusted Edge Function / encrypted Vault. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,KeyRound,Eye,EyeOff,RefreshCw,PlugZap,AlertTriangle} from 'lucide-react';
import {integrationAction} from './integrationApi';
const styles={panel:'ccx-surface p-5',input:'w-full rounded-xl border border-[#3A425D] bg-[#0B1426] p-3 text-sm text-white focus:ring-2 focus:ring-fuchsia-500',button:'ccx-action-primary rounded-xl px-4 py-2.5 text-sm'};
const names={yoti:'Yoti — ID, age and liveness',pass:'PASS — Performer work clearance',ccbill:'CCBill — Payments',docusign:'DocuSign — Releases',email:'Transactional email',webpush:'Browser notifications',maps:'Location maps',openmoderate:'Media moderation',sentry:'Error monitoring',flagsmith:'Feature flags'};
const help={yoti:'Yoti AVS uses your Yoti API key and SDK ID. Hosted checks work only after setting the return origin and completing provider onboarding.',pass:'PASS maintains 14-day yes/no work clearance. Store an approved partner credential here once PASS grants access; automatic status and production-hold checks remain disabled until the official API contract is received, mapped and tested. Never expose clinical results.',
ccbill:'Keys are encrypted, but financial captures stay blocked until the approved merchant integration and callback contract are verified.',
docusign:'Credentials here are saved securely; the current signing integration still requires its service account and approved template setup.',
email:'Connect an approved neutral transactional email relay before enabling delivery.',
webpush:'Browser VAPID public keys also need public client configuration; private keys remain server-side.',
maps:'Map tiles can use a public browser token; routing keys belong on the server.',
openmoderate:'Scanning workers still need verified provider deployment and human review.',
sentry:'DSN can be configured for production release monitoring.',
flagsmith:'Remote flags require environment and rollout verification.'};
export default function IntegrationSettings(){
 const [providers,setProviders]=useState([]),[values,setValues]=useState({}),[visible,setVisible]=useState({}),[agreements,setAgreements]=useState({});
 const [origins,setOrigins]=useState({ccx_origin:'',onlyhost_origin:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setBusy(true);setError('');
  try{const r=await integrationAction('admin_list');setProviders(r.providers||[]);const y=r.providers?.find(p=>p.provider==='yoti');if(y)setOrigins({ccx_origin:y.callback_origin||'',onlyhost_origin:y.secondary_origin||''});}catch(e){setError(e.message);}
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
   <p className="mt-2 text-sm text-[#AFBDD4]">Enter your provider keys once. Secret values are encrypted in Supabase Vault and are never displayed again. Changing credentials requires an authenticated administrator with MFA.</p></div>
   <button onClick={load} disabled={busy} className="ccx-secondary rounded-xl p-3" aria-label="Refresh provider status"><RefreshCw size={19}/></button>
  </header>
  <div className="ccx-surface flex items-start gap-3 p-4">
   <ShieldCheck className="mt-0.5 shrink-0 text-[#FF76D8]" size={21}/>
   <p className="text-sm text-[#C9D5E8]">Credentials present does not mean an integration is approved or live. Yoti needs its return-origin setting. PASS partner API access must be confirmed directly with PASS. Payment and health workflows remain protected by server-side release gates.</p>
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  <section className="ccx-surface space-y-3 p-5">
    <h3 className="font-semibold">Yoti return domains for both brands</h3>
    <p className="text-xs text-[#B5C6DF]">These are HTTPS public website origins, not secret keys. Configure them in your Yoti provider account as approved callback destinations before starting live sessions.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Content Connect X website origin<input className={styles.input+' mt-1'} type="url" placeholder="https://contentconnectx.com" value={origins.ccx_origin}
        onChange={e=>setOrigins(v=>({...v,ccx_origin:e.target.value}))}/></label>
      <label className="text-xs">OnlyHost website origin<input className={styles.input+' mt-1'} type="url" placeholder="https://your-onlyhost-domain.example" value={origins.onlyhost_origin}
        onChange={e=>setOrigins(v=>({...v,onlyhost_origin:e.target.value}))}/></label>
    </div>
    <button className={styles.button} disabled={busy||!origins.ccx_origin} onClick={async()=>{setBusy(true);setError('');setNotice('');
      try{const r=await integrationAction('admin_yoti_origins',origins);setNotice(r.note||'Saved.');await load();}
      catch(e){setError(e.message);}finally{setBusy(false);}
    }}>Save Yoti callback URLs</button>
  </section>
  <div className="grid gap-4 lg:grid-cols-2">
   {providers.map(p=><article key={p.provider} className={styles.panel+' space-y-3'}>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h3 className="flex gap-2 items-center font-semibold"><PlugZap size={17} className="text-[#FF79D4]"/>{names[p.provider]||p.provider}</h3>
      <p className="mt-2 text-xs text-[#ADBDD3]">{help[p.provider]}</p></div>
     <span className={'rounded-full px-2 py-1 text-xs '+(p.enabled?'bg-emerald-900/50 text-emerald-200':'bg-[#2D3450] text-[#B6C5DB]')}>{p.enabled?'Enabled':'Disabled'}</span>
    </div>
    <div className="space-y-3">
     {(p.fields||[]).map(field=><div key={field.name}>
      <label className="block text-xs font-semibold text-[#B3BFD5]" htmlFor={'ccx-'+field.name}>{field.name.replaceAll('_',' ')} · {field.configured?'Stored':'Missing'}</label>
      <div className="mt-1 flex gap-2">
       <input id={'ccx-'+field.name} className={styles.input+' min-w-0 flex-1'} autoComplete="off" spellCheck={false}
        type={visible[field.name]?'text':'password'} placeholder={field.configured?'Replace saved credential':'Paste provider API credential'}
        value={values[field.name]||''} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}/>
       <button className="ccx-secondary rounded-xl px-3" aria-label={visible[field.name]?'Hide':'Show'} onClick={()=>setVisible(v=>({...v,[field.name]:!v[field.name]}))}>{visible[field.name]?<EyeOff size={17}/>:<Eye size={17}/>}</button>
       <button className={styles.button} onClick={()=>secret(p.provider,field.name)} disabled={busy||!(values[field.name]||'').trim()}><KeyRound size={16} className="inline mr-1"/>Save</button>
      </div>
     </div>)}
    </div>
    <div className="border-t border-[#35415B] pt-3">
     <label className="flex items-start gap-2 text-xs text-[#BECBE0]"><input type="checkbox" className="mt-1" checked={Boolean(agreements[p.provider])}
      onChange={e=>setAgreements(v=>({...v,[p.provider]:e.target.checked}))}/>
      I have reviewed the provider's actual contract, permitted use, data-handling terms and necessary credentials.</label>
     <button className="ccx-secondary mt-3 rounded-xl px-4 py-2 text-sm" disabled={busy||p.provider==='pass'||p.enabled===false&&!agreements[p.provider]}
      onClick={()=>toggle(p.provider,!p.enabled)}>{p.enabled?'Disable integration':'Enable configured integration'}</button>
     {p.provider==='pass'&&<p className="mt-2 text-xs text-amber-200"><AlertTriangle size={13} className="inline mr-1"/>Awaiting official PASS partner API and production-hold specification. Request integration details from info@passcertified.org. Until an approved integration is tested, check the official PASS database directly.</p>}
    </div>
   </article>)}
  </div>
 </div>;
}
