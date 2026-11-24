/** Isolated demonstration workspace. No live mutation or provider calls. */
import React,{useEffect,useMemo,useState} from 'react';
import {Search,UserRound,ArrowLeft,ShieldCheck,FileSignature} from 'lucide-react';
import MarketplaceExplore from './MarketplaceExplore';
import HostDialog from './HostDialog';
import {money,VENUE_ARTWORK} from './hostMapPresentation.mjs';
import {nightsBetween} from './hostingDateRange.mjs';
const label=v=>String(v||'').replaceAll('_',' ').replaceAll('-',' ');
const panel='rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5';
const field='w-full min-h-11 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2 text-sm';
const btn='min-h-11 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-2 text-sm font-semibold';
const sectionsHost=[['dashboard','Dashboard'],['explore','Properties'],['bookings','Reservations'],['calendar','Calendar'],['cleaning','Cleaning'],['equipment','Equipment'],['agreements','Agreements'],['administration','Administration']];
const sectionsCCX=[['dashboard','Dashboard'],['directory','Discovery'],['hosting','Properties'],['community','Feed'],['connections','Connections'],['messages','Messages'],['collaborations','Collaborations'],['contracts','Agreements'],['schedule','Calendar'],['media','Galleries'],['notifications','Notifications'],['shop','Shop'],['administration','Administration']];
function sectionKey(value){
 if(['directory','favorites','connections','profile','public-profile','roster','representations'].includes(value))return 'profiles';
 if(['explore','hosting','host','host-settings','listings','create-listing','review'].includes(value))return 'properties';
 if(['bookings','requests','guest-home'].includes(value))return 'bookings';
 if(['calendar','schedule','schedules'].includes(value))return 'calendar';
 if(['community','groups','feedback','feed'].includes(value))return 'feed';
 if(['workspace','collaborations','production','meeting'].includes(value))return 'collaborations';
 if(['contracts','agreements'].includes(value))return 'contracts';
 if(['staff','cleaning','issues','tools','cleaner'].includes(value))return 'cleaning';
 if(['portfolio','media'].includes(value))return 'media';
 if(['admin-diagnostics','administration','controls','integrations','settings','developer','account-security'].includes(value))return 'administration';
 if(['verification','reviews','testing','testing-reviews','trust','consent','safety','reputation'].includes(value))return 'trust';
 if(['messages','notifications','equipment','shop','membership'].includes(value))return value;
 return 'dashboard';
}
export default function AdminDemoWorkspace({data,section='dashboard',brand='host',onNavigate=(_id)=>{void _id;}}){
 const [local,setLocal]=useState(section),[filters,setFilters]=useState({}),[profileQuery,setProfileQuery]=useState(''),[role,setRole]=useState(''),[gender,setGender]=useState(''),[detail,setDetail]=useState(null),[duration,setDuration]=useState(6),[mode,setMode]=useState('hour'),[sampleNotice,setSampleNotice]=useState('');
 useEffect(()=>{setLocal(section);setDetail(null);setSampleNotice('');},[section]);
 const active=sectionKey(local);
 const properties=useMemo(()=>data.properties.filter(p=>{
  const f=filters||{},lower=x=>String(x||'').toLowerCase();
  if(f.city&&!lower(p.city).includes(lower(f.city))||f.state&&!lower(p.state).includes(lower(f.state))||f.country&&!lower(p.country).includes(lower(f.country)))return false;
  if(f.query&&!lower(p.title+' '+p.category).includes(lower(f.query)))return false;
  if(f.categories?.length&&!f.categories.some(x=>x===p.category||x==='pool'&&p.amenities.includes('pool')))return false;
  if(f.category&&f.category!==p.category)return false;
  if(f.crew_size&&p.capacity<f.crew_size)return false;
  if(f.amenities?.some(x=>!p.amenities.includes(x)))return false;
  const b=f.bounds;if(b&&(p.approx_lat<b.south||p.approx_lat>b.north||(b.west<=b.east?(p.approx_lng<b.west||p.approx_lng>b.east):(p.approx_lng<b.west&&p.approx_lng>b.east))))return false;
  return true;
 }).map(p=>{const days=nightsBetween(filters.start_date,filters.end_date);return days?{...p,stay_total_cents:days*p.daily_rate_cents+p.cleaning_fee_cents,stay_days:days,date_availability_checked:false}:p;}),[data,filters]);
 const profiles=data.profiles.filter(p=>(!role||p.role_type===role)&&(!gender||p.gender===gender)&&(!profileQuery||[p.display_name,p.role_type,p.city,p.state].join(' ').toLowerCase().includes(profileQuery.toLowerCase())));
 const open=p=>{setDetail(p);setDuration(6);setMode('hour');setSampleNotice('');};
 const go=id=>{setLocal(id);setDetail(null);setSampleNotice('');onNavigate(id);};
 const records=data.examples[active]||data.examples.dashboard;
 return <section className="space-y-5" data-admin-demo-workspace="true">
  <div className="rounded-2xl border border-amber-400 bg-amber-50 p-4 text-amber-950"><strong className="flex items-center gap-2"><ShieldCheck size={19}/> MOCK DATA · ADMIN DEMONSTRATION</strong><p className="mt-1 text-sm">Fictional, repeatable examples only. No real accounts, reservations, payments, signatures, emails or database changes. Toggle Mock data off to return to live records.</p></div>
  <nav className="flex flex-wrap gap-2" aria-label="Demonstration sections">{(brand==='host'?sectionsHost:sectionsCCX).map(([id,title])=><button type="button" key={id} className={btn+' '+(local===id?'font-bold ring-2 ring-[#12698f]':'')} onClick={()=>go(id)}>{title}</button>)}</nav>
  {active==='properties'?<MarketplaceExplore items={properties} onSearch={setFilters} onOpen={id=>{const p=data.properties.find(x=>x.id===id);if(p)open(p);}} site={brand} demo={true}/>:
   active==='profiles'?<div className="space-y-4">
    <div><h2 className="text-2xl font-bold">Discovery — sample profiles</h2><p className="text-sm text-[var(--cc-text-secondary)]">Search fictional people by name, profession, gender or city.</p></div>
    <div className={panel+' grid gap-3 sm:grid-cols-3'}><label className="text-sm"><Search size={15} className="inline"/> Search<input className={field} value={profileQuery} onChange={e=>setProfileQuery(e.target.value)} placeholder="Name, role or location"/></label>
     <label className="text-sm">Profession<select className={field} value={role} onChange={e=>setRole(e.target.value)}><option value="">All professionals</option>{[...new Set(data.profiles.map(p=>p.role_type))].map(r=><option key={String(r)} value={String(r)}>{label(r)}</option>)}</select></label>
     <label className="text-sm">Gender<select className={field} value={gender} onChange={e=>setGender(e.target.value)}><option value="">Everyone</option><option value="woman">Female</option><option value="man">Male</option></select></label></div>
    <p className="text-sm font-semibold">{profiles.length} sample profiles</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profiles.map(p=><button type="button" key={p.id} className={panel+' text-left hover:shadow-md'} onClick={()=>open(p)}>
     <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-[var(--cc-surface-subtle)]"><UserRound size={55} className="text-[var(--cc-link)]"/></div>
     <h3 className="font-semibold">{p.display_name}</h3><p className="text-sm capitalize">{label(p.role_type)} · {p.city}, {p.state}</p><p className="mt-2 text-xs text-[var(--cc-text-secondary)]">Demo profile · {p.avatar_ref}</p></button>)}</div>
   </div>:<div className="space-y-3"><h2 className="text-2xl font-semibold capitalize">{label(active)} — example records</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{records.map(([title,state,description],i)=><article key={i} className={panel}><h3 className="font-semibold">{title}</h3><p className="mt-2 font-medium text-[var(--cc-link)]">{state}</p><p className="mt-3 text-sm text-[var(--cc-text-secondary)]">{description}</p><span className="mt-4 inline-block text-xs text-[var(--cc-text-muted)]">Example record</span></article>)}</div>
    {active==='dashboard'&&<div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={()=>go(brand==='host'?'explore':'directory')}>Explore {brand==='host'?'properties':'profiles'}</button><button type="button" className={btn} onClick={()=>go(brand==='host'?'bookings':'hosting')}>View {brand==='host'?'reservations':'properties'}</button></div>}</div>}
  {detail&&<HostDialog title={detail.title||detail.display_name} subtitle="Fictional demonstration" onClose={()=>setDetail(null)}>
   <div className="space-y-4 p-1">{detail.category?<><img src={VENUE_ARTWORK[detail.category]||VENUE_ARTWORK.other} alt="" className="mx-auto h-28 w-28 object-contain"/>
    <p>{detail.city}, {detail.state} · {label(detail.category)} · Up to {detail.capacity} crew</p>
    <p className="font-semibold">{money(detail.daily_rate_cents)}/day · {money(detail.hourly_rate_cents)}/hour</p>
    <label className="text-sm">Rental type<select className={field} value={mode} onChange={e=>{setMode(e.target.value);setDuration(e.target.value==='hour'?6:1);setSampleNotice('');}}><option value="hour">Hours</option><option value="day">Days</option></select></label>
    <label className="text-sm">Duration<input className={field} type="number" min={mode==='hour'?detail.min_rental_hours:1} max={mode==='hour'?24:90} value={duration} onChange={e=>{setDuration(Number(e.target.value));setSampleNotice('');}}/></label>
    <p className="font-semibold">Illustrative total: {money(duration*(mode==='hour'?detail.hourly_rate_cents:detail.daily_rate_cents)+detail.cleaning_fee_cents)} including sample cleaning fee</p>
    <button type="button" className={btn} disabled={!Number.isInteger(duration)||duration<(mode==='hour'?detail.min_rental_hours:1)||duration>(mode==='hour'?24:90)} onClick={()=>setSampleNotice('Sample reservation preview complete. Nothing was sent, booked or charged.')}><FileSignature size={15} className="inline"/> Preview booking request</button></>:<>
    <UserRound className="mx-auto" size={80}/><p className="capitalize">{label(detail.role_type)} · {detail.city}, {detail.state}</p><p>{detail.bio}</p><p>Portrait slot: {detail.avatar_ref}</p><button type="button" className={btn} onClick={()=>setSampleNotice('Sample collaboration preview. No message or invitation was sent.')}>Preview collaboration</button></>}
    {sampleNotice&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-950">{sampleNotice}</p>}
    <button type="button" className={btn} onClick={()=>setDetail(null)}><ArrowLeft size={15} className="inline"/> Back</button>
   </div></HostDialog>}
 </section>;
}
