/** Owner-only contact/profile editing. Phone, address and legal name are private. */
import React,{useEffect,useState} from 'react';
import {Camera,Save,UserRound,ShieldCheck} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import HostDialog from './HostDialog';
const empty={display_name:'',legal_name:'',company_name:'',contact_email:'',phone:'',city:'',region:'',country:'',postal_address:'',postal_code:'',bio:'',languages:[],timezone:'America/Phoenix',emergency_contact_name:'',emergency_contact_phone:'',avatar_path:null};
const fieldClass='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-3 text-sm text-[var(--cc-text-primary)] outline-none focus:ring-2 focus:ring-cyan-400';
/** @type {Array<[string,string,number,string]>} */
const fields=[['display_name','Host display name',100,'text'],['legal_name','Legal name (private)',150,'text'],['company_name','Company / property management name',150,'text'],['contact_email','Contact email (private)',254,'email'],['phone','Phone number (private)',40,'tel'],['city','City',100,'text'],['region','State / region',100,'text'],['country','Country',100,'text'],['postal_address','Mailing address (private)',400,'text'],['postal_code','Postal code (private)',24,'text'],['timezone','Time zone, for example America/Phoenix',100,'text'],['emergency_contact_name','Emergency contact name (private)',100,'text'],['emergency_contact_phone','Emergency contact phone (private)',40,'tel']];
/** @param {{user:any,onClose:()=>void,onSaved?:()=>void}} props */
export default function HostProfileSettings({user,onClose,onSaved}){
 const [form,setForm]=useState({...empty,contact_email:user.email||''}),[languages,setLanguages]=useState('');
 const [photo,setPhoto]=useState(/** @type {File|null} */(null)),[preview,setPreview]=useState('');
 const [loaded,setLoaded]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;void(async()=>{
  try{const {data,error}=await supabase.from('host_profiles').select('*').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!active)return;
   if(data){setForm({...empty,...data});setLanguages((data.languages||[]).join(', '));if(data.avatar_path){const {data:link,error:signError}=await supabase.storage.from('host-profile-photos').createSignedUrl(data.avatar_path,900);if(signError)throw signError;if(active)setPreview(link?.signedUrl||'');}}
   if(active)setLoaded(true);
  }catch(e){if(active)setError(e.message);}finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[user.id]);
 useEffect(()=>{if(!photo)return;const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
 const choose=file=>{if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Choose a JPG, PNG or WebP photo under 5MB.');return;}setPhoto(file);setError('');};
 const save=async event=>{
  event.preventDefault();if(!loaded)return;setBusy(true);setError('');setNotice('');let uploaded='';let persisted=false;
  try{
   if(!form.display_name.trim())throw Error('Enter a host display name.');
   try{new Intl.DateTimeFormat('en-US',{timeZone:form.timezone}).format();}catch{throw Error('Enter a valid time zone, such as America/Phoenix.');}
   const spoken=[...new Set(languages.split(',').map(v=>v.trim()).filter(Boolean))];if(spoken.length>20||spoken.some(v=>v.length>60))throw Error('Enter up to 20 languages, separated by commas.');
   let avatar=form.avatar_path;
   if(photo){const ext={ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.type];uploaded=user.id+'/'+crypto.randomUUID()+'.'+ext;
    const {error}=await supabase.storage.from('host-profile-photos').upload(uploaded,photo,{contentType:photo.type,upsert:false});if(error)throw error;avatar=uploaded;}
   const payload=Object.fromEntries(Object.keys(empty).map(key=>[key,form[key]]));
   const {error}=await supabase.from('host_profiles').upsert({...payload,user_id:user.id,display_name:form.display_name.trim(),languages:spoken,avatar_path:avatar,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;
   if(avatar){const {data:link}=await supabase.storage.from('host-profile-photos').createSignedUrl(avatar,900);setPreview(link?.signedUrl||'');}
   persisted=true;
   if(uploaded&&form.avatar_path&&form.avatar_path!==uploaded)await supabase.storage.from('host-profile-photos').remove([form.avatar_path]);
   setForm(v=>({...v,avatar_path:avatar}));setPhoto(null);setNotice('Your host profile is saved. Contact details remain private.');onSaved?.();window.dispatchEvent(new Event('ccx-host-profile-changed'));
  }catch(e){if(uploaded&&!persisted)await supabase.storage.from('host-profile-photos').remove([uploaded]);setError(e.message||'Unable to save host profile.');}finally{setBusy(false);}
 };
 return <HostDialog title="Host Settings" subtitle="Your profile, contact details and hosting preferences." onClose={onClose} busy={busy}>
  {loading?<p role="status">Loading your host profile…</p>:<form onSubmit={save} className="space-y-6">
   <div className="oh-profile-photo-row"><div className="oh-host-avatar">{preview?<img src={preview} alt="Your host profile"/>:<UserRound size={40}/>}</div><div><h3 className="text-lg font-semibold">Your profile photo</h3><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">JPG, PNG or WebP · 5MB maximum</p><label className="oh-gallery-secondary mt-3 cursor-pointer"><Camera size={17}/>Choose photo<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>choose(event.target.files?.[0])}/></label></div></div>
   <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4 text-sm text-[var(--cc-link)]"><ShieldCheck size={17} className="mr-2 inline"/>Legal name, phone, contact email, mailing address and emergency contact are private account information. They are not included in public property search.</div>
   <p className="text-sm text-[var(--cc-text-secondary)]">Sign-in email: <strong>{user.email}</strong>. Updating your contact email here does not change your sign-in email.</p>
   <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key,label,max,type])=><label key={key} className="block text-sm"><span className="mb-2 block text-[var(--cc-text-secondary)]">{label}</span><input className={fieldClass} type={type} value={form[key]||''} maxLength={Number(max)} required={key==='display_name'||key==='timezone'} disabled={busy} onChange={event=>setForm(v=>({...v,[key]:event.target.value}))}/></label>)}</div>
   <label className="block text-sm">Languages spoken<input className={fieldClass+' mt-2'} value={languages} maxLength={800} placeholder="English, Spanish" onChange={e=>setLanguages(e.target.value)}/></label>
   <label className="block text-sm">About you as a host<textarea rows={4} className={fieldClass+' mt-2'} value={form.bio} maxLength={1500} placeholder="Tell guests about your hosting style and spaces." onChange={e=>setForm(v=>({...v,bio:e.target.value}))}/></label>
   {error&&<p role="alert" className="oh-inline-error">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
   <button className="oh-gallery-primary" disabled={busy||!loaded}><Save size={17}/>{busy?'Saving…':'Save host profile'}</button>
  </form>}
 </HostDialog>;
}
