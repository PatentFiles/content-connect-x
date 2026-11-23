import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {TRUST_LINKS,TRUST_PAGES} from './trustContent.mjs';
import {readTracking,saveTracking} from './trackingPreferences.mjs';
import {validateTrustRequest} from '../../supabase/functions/trust-intake/policy.mjs';
import TrustReporterStatus from './TrustReporterStatus';
import BrandWordmark from './BrandWordmark';
import './trust-site.css';
const kinds=[['ncii','Non-consensual intimate imagery'],['trafficking','Trafficking or coercion'],['csam','Suspected child exploitation'],['privacy','Privacy request'],['support','Account or technical support'],['copyright','Copyright concern'],['law_enforcement','Law-enforcement request'],['accessibility','Accessibility barrier'],['affiliate','Non-explicit professional partnership'],['appeal','Review or appeal'],['other','Other concern']];
const emailLink=value=>typeof value==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?'mailto:'+encodeURIComponent(value):null;
/** Footer links deliberately navigate to dedicated trust pages rather than
 * mounting a shared modal. This is safe on browser Back/Forward, refresh,
 * mobile webviews, and when network requests for a form fail.
 */
export function TrustFooter({legalPage=false,homePage=false}){
 return <footer className={'ccx-trust-footer'+(legalPage?' ccx-trust-footer-standalone':'')} data-homepage={homePage?'true':undefined}>
  <div className="ccx-trust-footer-top">
   <div><span className="ccx-trust-brand"><BrandWordmark brand="content"/></span>
    <p>Professional collaboration. Clear consent. Accountable access.</p>
    <p className="ccx-trust-partner">Production locations and daily rentals: <a className="ccx-home-host-link" href="https://hostconnectx.com" target="_blank" rel="noopener noreferrer" aria-label="Visit Host ConnectX"><BrandWordmark brand="host"/></a></p>
   </div>
   <a className="ccx-trust-report-link" href="/trust/content-removal">Content removal &amp; safety</a>
  </div>
  <nav aria-label="Legal, safety and support">
   {TRUST_LINKS.map(([slug,title])=><a key={slug} href={'/trust/'+slug}>{title}</a>)}
  </nav>
  <div className="ccx-trust-footer-bottom">
   <p>© {new Date().getFullYear()} Content ConnectX · Adults only</p>
   <p><a href="/trust/law-enforcement">Lawful requests are reviewed case by case.</a> No unrestricted backend access.</p>
   <a href="/trust/review">Staff review</a>
  </div>
 </footer>;
}

function CookiePreferences(){
 const [choices,setChoices]=useState(()=>readTracking()),[error,setError]=useState('');
 const save=value=>{try{saveTracking(value);window.location.reload();}catch{setError('Your browser could not save this preference. No success was recorded. Optional services remain governed by the previously saved choice; close this tab to stop loaded services.');}};
 return <section className="ccx-trust-card"><h2>Cookie and optional-service preferences</h2><p>Necessary authentication and security storage remains enabled. Optional services default to off. Changes apply to this browser, not every device.</p>
  <div className="ccx-cookie-row"><span><strong>Necessary storage</strong><small>Sign-in, security and your saved privacy preference.</small></span><span>Always active</span></div>
  {[['diagnostics','Optional error diagnostics','Sanitized error reporting when configured. No session replay.'],['experiments','Optional interface experiments','UI experiment service when configured. Never controls access permissions.']].map(([key,label,hint])=><label key={key} className="ccx-cookie-row"><span><strong>{label}</strong><small>{hint}</small></span><input type="checkbox" checked={choices[key]} onChange={e=>setChoices(v=>({...v,[key]:e.target.checked}))}/></label>)}
  <div className="ccx-cookie-row"><span><strong>Advertising tracking</strong><small>No advertising pixels or orientation-based ad profiling are activated by this release.</small></span><span>Off</span></div>
  <p>Saving reloads this page so any previously loaded optional service stops. Unsaved changes on other pages may be lost.</p>
  <div className="ccx-trust-actions"><button type="button" onClick={()=>save({diagnostics:false,experiments:false})}>Reject optional services</button><button type="button" className="ccx-trust-primary" onClick={()=>save(choices)}>Save preferences and reload</button></div>
  {error&&<p role="alert" className="ccx-trust-error">{error}</p>}
 </section>;
}
function RequestForm({initialKind,config,configError,originSlug=''}){
 const [fields,setFields]=useState({kind:initialKind,name:'',email:'',locator:(new URLSearchParams(window.location.search).get('locator')||(originSlug&&originSlug!=='support'?'/trust/'+originSlug:'')).slice(0,3000),details:'',signature:'',authorized:false,good_faith:false,agency:'',jurisdiction:'',case_reference:'',legal_basis:'',scope:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(null);
 const key=useRef(null),lock=useRef(false);
 const change=(name,value)=>{key.current=null;setFields(old=>({...old,[name]:value}));};
 if(!config?.ready)return <><aside className="ccx-trust-callout" role="status"><h2>Request intake is not open yet</h2><p>{configError?'The intake configuration could not be verified. No report can be submitted here.':'This reporting service is held closed until operator contacts and staffed review coverage are confirmed. No report has been submitted.'}</p>{emailLink(config?.contact_email)&&<p>Contact: <a href={emailLink(config.contact_email)}>{config.contact_email}</a></p>}<p>For immediate danger, contact local emergency services. This website is not an emergency-response service.</p></aside><TrustReporterStatus/></>;
 const submit=async event=>{
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   key.current||=crypto.randomUUID();
   const body={...fields,idempotency_key:key.current};validateTrustRequest(body);
   const {data,error:failure}=await supabase.functions.invoke('trust-intake',{body});
   if(failure||data?.error||data?.received!==true||!data.reference)throw Error(data?.error||'No receipt was confirmed. Keep your text and retry, or use the published contact email.');
   setReceipt({reference:data.reference,accessCode:key.current});
  }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
 };
 if(receipt)return <><section className="ccx-trust-card" role="status"><h2>Request recorded</h2><p>Keep this reference: <strong className="ccx-trust-reference">{receipt.reference}</strong></p><p>Your private access code: <code className="ccx-trust-reference break-all">{receipt.accessCode}</code></p><p>Save both separately before leaving. The private code is not emailed or saved to this browser. This confirms receipt, not removal, a finding of wrongdoing, or notification delivery.</p></section><TrustReporterStatus initialReference={receipt.reference} initialAccessCode={receipt.accessCode}/></>;
 const law=fields.kind==='law_enforcement',ncii=fields.kind==='ncii';
 return <form className="ccx-trust-card ccx-request-form" onSubmit={submit}><h2>Submit a confidential request</h2><p>No account or payment is required. Provide only necessary facts. Do not upload, download or copy suspected illegal imagery. Do not include passwords, payment-card numbers, ID images or medical documents.</p>
  <fieldset disabled={busy}><label>Request category<select value={fields.kind} onChange={e=>change('kind',e.target.value)}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <div className="ccx-trust-two"><label>Your name (optional)<input value={fields.name} maxLength={120} onChange={e=>change('name',e.target.value)} autoComplete="name"/></label><label>{law?'Official contact email':ncii?'Contact email':'Contact email (optional)'}<input type="email" required={law||ncii} value={fields.email} maxLength={254} onChange={e=>change('email',e.target.value)} autoComplete="email"/></label></div>
  <label>Content URL or relevant profile / case reference<input value={fields.locator} required={ncii} minLength={ncii?3:undefined} maxLength={3000} onChange={e=>change('locator',e.target.value)}/></label>
  <label>Describe your concern or request<textarea value={fields.details} required minLength={10} maxLength={4000} rows={5} onChange={e=>change('details',e.target.value)}/></label>
  {ncii&&<><label>Electronic signature<input value={fields.signature} required minLength={2} maxLength={150} onChange={e=>change('signature',e.target.value)} placeholder="Type your name"/></label><label className="ccx-trust-check"><input type="checkbox" required checked={fields.authorized} onChange={e=>change('authorized',e.target.checked)}/><span>I am depicted in the material or am authorized to act on behalf of the depicted person.</span></label><label className="ccx-trust-check"><input type="checkbox" required checked={fields.good_faith} onChange={e=>change('good_faith',e.target.checked)}/><span>I have a good-faith belief that the intimate depiction was published without the depicted person’s consent, including any applicable synthetic or manipulated depiction.</span></label></>}
  {law&&<><p>Submitting this form never grants system access. Do not attach warrants or private evidence here; an independently verified secure channel is required for subsequent exchange.</p><div className="ccx-trust-two">{[['agency','Agency'],['jurisdiction','Jurisdiction'],['case_reference','Case reference'],['legal_basis','Applicable legal authority']].map(([field,label])=><label key={field}>{label}<input required minLength={field==='legal_basis'?5:2} value={fields[field]} maxLength={254} onChange={e=>change(field,e.target.value)}/></label>)}</div><label>Precisely scoped records, identifiers and time range<textarea required minLength={5} maxLength={4000} rows={3} value={fields.scope} onChange={e=>change('scope',e.target.value)}/></label></>}
  <p className="ccx-trust-small">Your submission is restricted to authorized reviewers and handled for the request, safety and applicable legal obligations. Do not use this channel to submit knowingly false reports.</p><button className="ccx-trust-primary" type="submit">{busy?'Recording request…':'Submit request'}</button></fieldset>
  {error&&<p role="alert" className="ccx-trust-error">{error}</p>}
 </form>;
}
function StaffReview(){
 const [items,setItems]=useState([]),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[status,setStatus]=useState('reviewing');
 const [reviewerId,setReviewerId]=useState(null);
 const call=async args=>{const {data,error:failure}=await supabase.rpc('ccx_trust_review',args);if(failure)throw Error(failure.message);return data;};
 const triage=async args=>{const {data,error:failure}=await supabase.rpc('ccx_trust_triage',args);if(failure)throw Error(failure.message);return data;};
 const load=async()=>{setBusy(true);setError('');try{const result=await triage({p_action:'list'});setItems(result.items||[]);setReviewerId(result.reviewer_id||null);}catch(e){setItems([]);setSelected(null);setError(e.message);}finally{setBusy(false);}};
 const open=async id=>{setBusy(true);setSelected(null);setNote('');setError('');try{setSelected(await call({p_action:'read',p_id:id}));}catch(e){setError(e.message);}finally{setBusy(false);}};
 const update=async event=>{event.preventDefault();setBusy(true);setError('');try{await call({p_action:'update',p_id:selected.id,p_status:status,p_note:note});setSelected(null);setNote('');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const claim=async caseId=>{setBusy(true);setError('');try{await triage({p_action:'claim',p_id:caseId});setSelected(await call({p_action:'read',p_id:caseId}));await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const release=async caseId=>{setBusy(true);setError('');try{await triage({p_action:'release',p_id:caseId});setSelected(await call({p_action:'read',p_id:caseId}));await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="ccx-trust-card"><h2>Restricted staff review</h2><p>Requires an existing, active administrator account and a two-factor-authenticated session. This is not an agency portal. Every queue view, case view and status change is audited.</p><p>Recording an outcome does not automatically remove content, notify the reporter or disclose evidence. Follow the approved runbook and record what was actually done.</p><button type="button" onClick={load} disabled={busy}>Load review queue</button><a className="ccx-trust-inline" href="/login">Sign in</a>
  {error&&<p role="alert" className="ccx-trust-error">{error}</p>}
  <div className="ccx-trust-cases">{items.map(item=><button type="button" disabled={busy} key={item.id} onClick={()=>open(item.id)}><strong>{item.kind.replaceAll('_',' ')} · {item.priority}</strong><span>{item.status} · {new Date(item.created_at).toLocaleString()}</span>{item.assigned_reviewer_id&&<small>Assigned to a reviewer</small>}{item.overdue&&<small role="alert" className="font-semibold text-red-800">Internal triage target overdue — escalate now</small>}{item.due_at&&<small>Internal triage target: {new Date(item.due_at).toLocaleString()}</small>}<small>{item.id}</small></button>)}</div>
  {selected&&<section className="ccx-trust-case"><h3>Case {selected.id}</h3><div className="flex flex-wrap gap-2 py-3">{selected.assigned_reviewer_id?(selected.assigned_reviewer_id===reviewerId?<button type="button" disabled={busy||selected.status==='resolved'} onClick={()=>void release(selected.id)}>Release my claim</button>:<p className="text-xs">This case is claimed by another authorized reviewer.</p>):<button type="button" disabled={busy||selected.status==='resolved'} onClick={()=>void claim(selected.id)}>Claim case for review</button>}</div><p className="text-xs text-[var(--cc-text-secondary)]">A verified staff member must claim the case before recording an outcome. If assigned to someone else, the backend will reject your release or update.</p><dl>{Object.entries(selected.payload||{}).filter(([,value])=>value!==''&&value!==false).map(([field,value])=><React.Fragment key={field}><dt>{field.replaceAll('_',' ')}</dt><dd>{String(value)}</dd></React.Fragment>)}</dl><form onSubmit={update}><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="reviewing">Reviewing</option><option value="action_required">Action required</option><option value="resolved">Resolved</option></select></label><label>Actual action taken / review note<textarea required minLength={10} maxLength={2000} rows={4} value={note} onChange={e=>setNote(e.target.value)}/></label><button type="submit" disabled={busy||!reviewerId||selected.assigned_reviewer_id!==reviewerId}>Record reviewed outcome</button></form></section>}
 </section>;
}
export default function TrustSite({children}){
 const path=window.location.pathname.replace(/\/+$/,'');
 const match=/^\/trust(?:\/([^/]+))?$/.exec(path),slug=match?.[1]||'support';
 const legalPage=Boolean(match),page=TRUST_PAGES[slug];
 const [config,setConfig]=useState(null),[configError,setConfigError]=useState(false);
 useEffect(()=>{
  if(!legalPage)return;let active=true;
  if(!supabase){setConfigError(true);return;}
  // PostgREST builders are PromiseLike, not Promise: assimilate before using catch.
  void Promise.resolve(supabase.rpc('ccx_trust_public_config')).then(({data,error})=>{if(active){setConfig(error?null:data);setConfigError(Boolean(error));}}).catch(()=>{if(active)setConfigError(true);});
  return()=>{active=false;};
 },[legalPage]);
 useEffect(()=>{if(legalPage)document.title=(page?.title|| (slug==='cookies'?'Cookie preferences':slug==='review'?'Staff review':'Trust & safety'))+' | Content ConnectX';},[legalPage,page,slug]);
 if(!legalPage)return <>{children}<TrustFooter homePage={path===''}/></>;
 const formKind={'content-removal':'ncii',support:'support',privacy:'privacy',accessibility:'accessibility',affiliates:'affiliate','law-enforcement':'law_enforcement'}[slug]||(page&&!['cookies','review'].includes(slug)?'support':null);
 return <div className="ccx-trust-layout"><header className="ccx-trust-header"><a className="ccx-trust-brand" href="/"><BrandWordmark brand="content"/></a><a href="/Dashboard">Return to workspace</a></header>
  <main className="ccx-trust-page"><p className="ccx-trust-eyebrow">TRUST · PRIVACY · SUPPORT</p><h1>{page?.title||(slug==='cookies'?'Cookie preferences':slug==='review'?'Staff review':'Page not found')}</h1>
   {!config?.policies_approved&&!['cookies','review'].includes(slug)&&<aside className="ccx-trust-draft"><strong>Pre-launch policy draft — operator and legal review required.</strong><p>This page is not a certification of worldwide compliance or a substitute for final terms. Public reporting is not active until the intake notice below confirms availability.</p></aside>}
   {config?.legal_entity&&<p className="ccx-trust-operator">Operator: {config.legal_entity}{config.postal_address?' · '+config.postal_address:''}{emailLink(config.contact_email)&&<> · <a href={emailLink(config.contact_email)}>{config.contact_email}</a></>}</p>}
   {page&&<article className="ccx-trust-copy"><p className="ccx-trust-intro">{page.intro}</p>{page.sections.map(([heading,body])=><section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}{slug==='anti-trafficking'&&<a className="ccx-trust-inline" href="/trust/content-removal">Go to Content removal & safety reports</a>}{slug==='content-removal'&&<p className="ccx-trust-small">Source: <a href="https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act" target="_blank" rel="noopener noreferrer">FTC guidance on the TAKE IT DOWN Act</a>.</p>}</article>}
   {slug==='law-enforcement'&&<p><a className="ccx-trust-inline" href="/law-enforcement-portal">Authorized agency portal sign-in</a></p>}
   {slug==='cookies'&&<CookiePreferences/>}{slug==='review'&&<StaffReview/>}{formKind&&<RequestForm initialKind={formKind} originSlug={slug} config={config} configError={configError}/>}
   {!page&&!['cookies','review'].includes(slug)&&<p>Choose a page from the footer below.</p>}
  </main><TrustFooter legalPage/>
 </div>;
}
