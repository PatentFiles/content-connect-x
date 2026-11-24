/** Public role-specific subscription catalog. Price edits originate from Supabase and are display-only
 * until an adult-industry-approved billing provider is operational and webhook-validated. */
import React,{useEffect,useState} from 'react';
import {ArrowRight,Check,ShieldCheck,UsersRound,Building2,LockKeyhole} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {membershipCall} from './membershipBillingApi';
import {PROFESSIONAL_ROLES,ROLE_BENEFITS,FREE_BENEFITS,DEFAULT_PREMIUM_PLANS,MEMBERSHIP_TERMS,membershipTermPrice} from './membershipCatalog.mjs';

function Card({eyebrow,title,price,features,subtitle,highlight=false,action,href='/signup',disabled=false,onClick=null}){
 return <article className={'flex h-full flex-col rounded-2xl border p-5 sm:p-7 '+
 (highlight?'border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] shadow-sm':'border-[var(--cc-border)] bg-[var(--cc-surface-subtle)]')}>
  <p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--cc-link)]">{eyebrow}</p>
  <h2 className="mt-2 text-xl font-bold text-[var(--cc-text-primary)]">{title}</h2>
  <div className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--cc-text-primary)]">{price}</div>
  <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--cc-text-secondary)]">{subtitle}</p>
  <ul className="mt-5 flex-1 space-y-3 border-t border-[var(--cc-border)] pt-5">
   {features.map(feature=><li key={feature} className="flex items-start gap-3 text-sm leading-6 text-[var(--cc-text-primary)]">
    <Check size={18} className="mt-1 shrink-0 text-[var(--cc-link)]"/><span>{feature}</span>
   </li>)}
  </ul>
  {onClick&&!disabled?<button type="button" onClick={onClick} className="ccx-primary mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--cc-text-primary)]">{action}<ArrowRight size={17}/></button>:disabled?<p className="mt-7 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-3 text-center text-sm font-semibold text-[var(--cc-text-secondary)]">{action}</p>:
   <a href={href||'/signup'} className="ccx-primary mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--cc-text-primary)]">{action}<ArrowRight size={17}/></a>}
 </article>;
}
export default function PublicPricing({signedIn=false,onNavigate=(destination)=>{void destination;},initialRole='creator'}){
 const [role,setRole]=useState(PROFESSIONAL_ROLES.some(x=>x.id===initialRole)?initialRole:'creator');
 const [plans,setPlans]=useState(DEFAULT_PREMIUM_PLANS);
 const [agentPlan,setAgentPlan]=useState('agent_10');
 const [termId,setTermId]=useState('monthly');
 const [billing,setBilling]=useState(null),[billingError,setBillingError]=useState(''),[paying,setPaying]=useState(false);
 const [confirmCancellation,setConfirmCancellation]=useState(false),[cancelling,setCancelling]=useState(false),[cancelNotice,setCancelNotice]=useState('');
 useEffect(()=>{
  if(!signedIn)return;
  let active=true;
  const refresh=()=>membershipCall('status').then(v=>{if(active){setBilling(v);setBillingError('');}}).catch(e=>{if(active)setBillingError(e.message);});
  void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15000);
  window.addEventListener('focus',refresh);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[signedIn]);
 const checkout=async()=>{
  if(!selected||paying)return;setPaying(true);setBillingError('');
  try{
   if(!offer||!termReady)throw Error('This billing term is not available yet.');
   const data=await membershipCall('create_checkout',{plan_code:selected.plan_code,period_days:offer.days,expected_amount_cents:offer.total_cents});
   if(data.amount_cents!==offer.total_cents||data.period_days!==offer.days)throw Error('This plan price was updated. Refresh the page and review the current price before paying.');
   const target=new URL(data.checkout_url);
   if(target.origin!=='https://api.ccbill.com'||!target.pathname.startsWith('/wap-frontflex/flexforms/'))throw Error('Invalid hosted checkout URL');
   window.location.assign(target.href);
  }catch(e){setBillingError(e.message);setPaying(false);}
 };
 const cancelRenewal=async()=>{
  if(cancelling)return;
  setCancelling(true);setBillingError('');setCancelNotice('');
  try{
   const result=await membershipCall('cancel_at_period_end');
   const fresh=await membershipCall('status');
   setBilling(fresh);setConfirmCancellation(false);
   setCancelNotice(result.note||'Renewal cancelled. Your existing access remains active through the paid-through date.');
  }catch(e){setBillingError(e.message||'Cancellation could not be confirmed. No change was reported.');}
  finally{setCancelling(false);}
 };
 const currentlyPaid=['active','trial'].includes(billing?.subscription?.status)&&(!billing.subscription.period_end||Date.parse(billing.subscription.period_end)>Date.now());

 useEffect(()=>{
  let live=true;
  void (async()=>{
   const {data,error}=await supabase.from('membership_plan_catalog')
    .select('plan_code,role_type,monthly_cents,label,roster_seats,display_order,active')
    .eq('active',true).order('display_order');
   if(live&&!error&&data?.length)setPlans(data);
  })().catch(()=>{});
  return()=>{live=false;};
 },[]);
 const matching=plans.filter(p=>p.role_type===role);
 const selected=matching.find(p=>p.plan_code===agentPlan)||matching[0];
 const offer=selected?membershipTermPrice(selected.monthly_cents,termId):null;
 const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
 const price=offer?money(offer.total_cents):'Not available';
 const termReady=Boolean(offer&&billing?.ready&&(offer.days===30||(billing.prepaid_max_cents||0)>=offer.total_cents));
 const isPrepaid=billing?.period_days===180||billing?.period_days===365;
 const premium=ROLE_BENEFITS[role]||ROLE_BENEFITS.creator;
 return <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
  <div className="mx-auto max-w-3xl text-center">
   <p className="ccx-eyebrow">Content ConnectX memberships</p>
   <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--cc-text-primary)] sm:text-5xl">
    Simple, <span className="ccx-gradient-text">transparent pricing.</span>
   </h1>
   <p className="mt-5 text-base leading-7 text-[var(--cc-text-secondary)]">
    Create your profile and independently verify you are 18 or older before using the protected network.
    Free members can discover creators worldwide; premium unlocks global collaboration.
   </p>
  </div>
  <section className="mt-9" aria-labelledby="pricing-role-heading">
   <h2 id="pricing-role-heading" className="text-center text-sm font-semibold text-[var(--cc-text-secondary)]">Choose your professional role</h2>
   <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2" role="group" aria-label="Professional pricing roles">
    {PROFESSIONAL_ROLES.map(item=><button key={item.id} type="button"
      onClick={()=>setRole(item.id)} aria-pressed={role===item.id}
      className={'rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors '+
       (role===item.id?'border-[var(--cc-border)] bg-[var(--cc-surface)] text-[var(--cc-text-primary)]':'border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] text-[var(--cc-text-secondary)] hover:border-[var(--cc-border)]')}>
       {item.label}</button>)}
   </div>
   <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-[var(--cc-text-secondary)]">{premium.description}</p>
   {role==='agent'&&<fieldset className="mx-auto mt-5 max-w-xl text-center">
    <legend className="mb-2 text-sm font-semibold">Agency capacity</legend>
    <div className="flex flex-wrap justify-center gap-2">
     {matching.map(plan=><button type="button" key={plan.plan_code} aria-pressed={selected?.plan_code===plan.plan_code}
      className={(selected?.plan_code===plan.plan_code?'ccx-primary':'ccx-secondary')+' rounded-xl px-3 py-2 text-sm'}
      onClick={()=>setAgentPlan(plan.plan_code)}>
      {plan.roster_seats===null?'100+ creators':'Up to '+plan.roster_seats}</button>)}
    </div>
   </fieldset>}
  </section>
  <section className="mx-auto mt-7 max-w-3xl" aria-label="Membership billing term">
   <h2 className="mb-3 text-center text-sm font-semibold">Choose your billing term</h2>
   <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2">
    {MEMBERSHIP_TERMS.map(term=><button type="button" key={term.id} aria-pressed={termId===term.id} disabled={paying}
      onClick={()=>{setTermId(term.id);setBillingError('');}}
      className={'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center text-sm font-semibold '+(termId===term.id?'border-[var(--cc-link)] bg-[var(--cc-surface)] text-[var(--cc-text-primary)] shadow-sm':'border-transparent text-[var(--cc-text-secondary)]')}>
       <span>{term.label}</span>{term.discount>0?<span className="text-xs font-bold text-green-700">Save {term.discount}%</span>:<span className="text-xs font-normal">Pay monthly</span>}
    </button>)}
   </div>
  </section>
  <section className="mx-auto mt-6 grid max-w-5xl gap-5 md:grid-cols-2" aria-label="Membership choices">
   <Card eyebrow="Get started" title="Free Membership" price="$0" subtitle="No payment is required for registration or independent age verification."
    features={FREE_BENEFITS} action={signedIn?'Free plan information':'Create a free account'} href="/signup" disabled={signedIn}/>
   <Card highlight eyebrow="Expanded access" title={role==='studio'?'Studio Membership':'Professional Membership'}
    price={offer?<>{price}<span className="ml-1 text-base font-medium text-[var(--cc-text-secondary)]">{offer.days===30?'per month':offer.days===180?'for 6 months':'per year'}</span></>:price}
    subtitle={offer?<>{role==='agent'&&<span className="block">{selected.label}</span>}{offer.days===30?'Monthly membership. Cancel future renewals at any time.':<><span className="block font-semibold text-green-700">Save {money(offer.savings_cents)} compared with monthly billing.</span><span className="block">Equivalent to about {money(offer.monthly_equivalent_cents)} per month · {money(offer.total_cents)} paid upfront.</span><span className="block">No automatic renewal.</span></>}</>:'Premium pricing is not available for this role.'}
    features={premium.items} disabled={!selected||paying||(signedIn&&(!termReady||currentlyPaid))} href="/signup" onClick={signedIn?checkout:null} action={!signedIn?'Create an account to subscribe':currentlyPaid?'Your membership is active':!selected?'Premium plan not yet configured for this role':paying?'Opening secure checkout…':termReady?'Continue to secure CCBill checkout':offer?.days!==30&&billing?.ready?'Prepaid checkout awaits merchant approval':'Membership checkout opens after approved billing is connected'}/>
  </section>
  <p className="mx-auto mt-4 max-w-5xl text-center text-xs leading-6 text-[var(--cc-text-secondary)]">
   Monthly memberships renew on CCBill’s 30-day billing cycle. Six-month and annual memberships are single prepaid terms of 180 and 365 days respectively, with no automatic renewal. Cancellation stops future monthly renewals and preserves paid access. No prorated refunds are provided, except where required by applicable law.
  </p>
  <section className="mx-auto mt-7 grid max-w-5xl gap-4 sm:grid-cols-3">
   <div className="ccx-surface p-5"><ShieldCheck size={22} className="text-[var(--cc-link)]"/><h3 className="mt-3 font-semibold text-[var(--cc-text-primary)]">Verified adults only</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--cc-text-secondary)]">Every member must complete independent 18+ verification before entering the professional network.</p></div>
   <div className="ccx-surface p-5"><UsersRound size={22} className="text-[var(--cc-link)]"/><h3 className="mt-3 font-semibold text-[var(--cc-text-primary)]">Free local introductions</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--cc-text-secondary)]">Up to five distinct local contacts within a rolling seven days; long-distance profiles remain searchable and savable.</p></div>
   <div className="ccx-surface p-5"><Building2 size={22} className="text-[var(--cc-link)]"/><h3 className="mt-3 font-semibold text-[var(--cc-text-primary)]">Host Connect locations</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--cc-text-secondary)]">Property listings and booking-based host fees belong to the independent Host Connect marketplace.</p></div>
  </section>
  <div className="mx-auto mt-7 max-w-5xl rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-5 text-sm leading-7 text-[var(--cc-text-secondary)]">
   <div className="flex items-center gap-2 font-semibold text-[var(--cc-text-primary)]"><LockKeyhole size={19}/> Billing status</div>
   <p className="mt-2">{billing?.ready?'Secure card entry is hosted by CCBill. Checkout confirms your selected term and total. Monthly memberships renew; prepaid memberships expire at the paid-through date without a rebill.':'Checkout opens after the approved recurring merchant account, hosted form and authenticated callback service are connected. No payment is needed to create a free account.'}</p>
   {billing?.subscription?.billing_provider==='ccbill'&&<section className="mt-4 space-y-3 rounded-xl border border-[var(--cc-border)] p-4" aria-label="Manage premium subscription">
    <h3 className="font-semibold text-[var(--cc-text-primary)]">Manage your premium membership</h3>
    <p>{isPrepaid?'Prepaid access ends:':'Next renewal / paid-through date:'} {billing.subscription.period_end?new Date(billing.subscription.period_end).toLocaleDateString():'See CCBill receipt'}. {isPrepaid?'No automatic renewal or cancellation is needed.':'Cancel any time before renewal. Premium access remains available through the already-paid period. Cancellation does not issue a refund.'}</p>
    {isPrepaid?<p role="status" className="font-semibold text-[var(--cc-text-primary)]">Prepaid membership — no recurring charge is scheduled.</p>:billing.cancel_at_period_end?<p role="status" className="font-semibold text-[var(--cc-text-primary)]">Renewal cancelled — no additional recurring charge is scheduled.</p>:
     <button type="button" className="ccx-secondary min-h-11 rounded-xl px-4 py-2 font-semibold" onClick={()=>setConfirmCancellation(true)}>Cancel subscription</button>}
    {confirmCancellation&&!isPrepaid&&!billing.cancel_at_period_end&&<div className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4">
     <p className="font-semibold text-[var(--cc-text-primary)]">Confirm cancellation of future renewals?</p>
     <p>Your current paid period is not refunded. Your membership will remain premium until the paid-through date, after which it will not renew.</p>
     <div className="flex flex-wrap gap-2">
      <button type="button" disabled={cancelling} className="ccx-primary min-h-11 rounded-xl px-4 py-2" onClick={()=>void cancelRenewal()}>{cancelling?'Contacting billing provider…':'Confirm cancellation'}</button>
      <button type="button" disabled={cancelling} className="ccx-secondary min-h-11 rounded-xl px-4 py-2" onClick={()=>setConfirmCancellation(false)}>Keep my membership</button>
     </div>
    </div>}
    <a className="inline-block font-semibold underline" href="https://support.ccbill.com" target="_blank" rel="noopener noreferrer">CCBill billing support</a>
   </section>}
   {cancelNotice&&<p role="status" className="mt-3 font-semibold text-[var(--cc-text-primary)]">{cancelNotice}</p>}
   {billing?.reconciliation_required&&<p role="status" className="mt-3 text-amber-800">A payment needs merchant reconciliation. Do not submit a second payment; contact support with your CCBill receipt.</p>}
   {billingError&&<p role="alert" className="mt-3 text-red-800">{billingError}</p>}
  </div>
  <div className="mt-10 flex justify-center">
   {signedIn?<button type="button" className="ccx-secondary rounded-xl px-5 py-3 text-sm font-semibold"
      onClick={()=>onNavigate?.('dashboard')}>Back to dashboard</button>:
     <a href="/" className="ccx-secondary rounded-xl px-5 py-3 text-sm font-semibold">Back to homepage</a>}
  </div>
 </main>;
}
