/** Uses the same server-authorized directory as Discovery. No private profile queries. */
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import {countryName} from './profileOptions';
import {validateWorkLink,roleTitle} from './roleWorkspacePolicy.mjs';
async function directory(body){
 const {data,error}=await supabase.functions.invoke('directory',{body});
 if(error||data?.error)throw Error(data?.error||'Profiles are unavailable. Check your access or try again.');
 return data?.results||[];
}
export default function DashboardPeople({widget,profile,onNavigate}){
 const workspace=useRoleWorkspace();
 const [people,setPeople]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[links,setLinks]=useState({}),[detailError,setDetailError]=useState('');
 const dialog=useRef(null),selection=useRef(0);
 const city=String(profile?.city||'').trim(),country=countryName(profile?.country||'');
 const needsLocation=widget.local&&(!city||!country);
 useEffect(()=>{
  let active=true;setPeople([]);setError('');setLoading(!needsLocation);
  if(needsLocation)return()=>{active=false;};
  directory({mode:'discovery',role:widget.role||'',...(widget.local?{city,country,state:profile?.state||''}:{})})
   .then(rows=>{if(active)setPeople(rows.slice(0,4));})
   .catch(e=>{if(active)setError(e.message);})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[widget.id,widget.role,widget.local,needsLocation,city,country,profile?.state,workspace?.user?.id,retry]);
 useEffect(()=>{
  if(!selected)return;
  const element=dialog.current,request=++selection.current;
  setDetail(null);setLinks({});setDetailError('');element?.showModal();
  // Recheck visibility when a card is opened: blocks and suspension may have changed.
  directory({mode:'discovery',ids:[selected.id]}).then(async rows=>{
   if(request!==selection.current)return;
   const person=rows.find(row=>row.id===selected.id);
   if(!person)throw Error('This profile is no longer available.');
   setDetail(person);
   // The server enforces membership and the profile owner's link permissions.
   const {data,error:failure}=await supabase.functions.invoke('member-workflows',{body:{action:'view_social_links',target_user_id:person.id}});
   if(request===selection.current&&!failure&&!data?.error)setLinks(data?.socials||{});
  }).catch(e=>{if(request===selection.current)setDetailError(e.message);});
  return()=>{selection.current++;element?.close();};
 },[selected]);
 if(needsLocation)return <div className="ccx-widget-note"><p>Add your city and country to find nearby creators. Exact location is never requested.</p><button type="button" onClick={()=>onNavigate('profile')}>Update my profile</button></div>;
 if(loading)return <p role="status" className="ccx-widget-note">Loading available profiles…</p>;
 if(error)return <div role="alert" className="ccx-widget-note"><p>{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>;
 return <div className="ccx-dashboard-people">
  <p className="ccx-widget-note">{widget.local?'Matches your profile city; not a distance or GPS ranking.':'Available complete profiles, alphabetical order. Not a paid placement or quality ranking.'}</p>
  {!people.length&&<p className="ccx-widget-note">No matching profiles yet. New eligible profiles will appear here.</p>}
  <div className="ccx-people-list">{people.map(person=><button type="button" key={person.id} className="ccx-person-preview" onClick={()=>setSelected(person)} aria-label={'Open '+person.display_name+' profile'}>
   <span className="ccx-person-avatar">{person.avatar_url?<img src={person.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<span aria-hidden="true">{(person.display_name||'?').slice(0,1)}</span>}</span>
   <span className="ccx-person-text"><strong>{person.display_name}</strong><span>{roleTitle(person.role_type)}</span><small>{[person.city,person.state,person.country].filter(Boolean).join(', ')||'Location not shared'}</small></span><span aria-hidden="true">↗</span>
  </button>)}</div>
  <button type="button" className="ccx-widget-link" onClick={()=>onNavigate('directory')}>Explore the directory</button>
  {selected&&<dialog ref={dialog} className="ccx-profile-dialog" aria-labelledby="ccx-profile-heading" onCancel={()=>setSelected(null)} onClose={()=>setSelected(null)}>
   <header><h2 id="ccx-profile-heading">Professional profile</h2><button type="button" autoFocus onClick={()=>setSelected(null)} aria-label="Close profile">Close</button></header>
   {detailError?<p role="alert">{detailError}</p>:!detail?<p role="status">Checking profile access…</p>:<>
    {detail.avatar_url&&<img className="ccx-profile-portrait" src={detail.avatar_url} alt="" referrerPolicy="no-referrer"/>}
    <h3>{detail.display_name}</h3><p>{roleTitle(detail.role_type)}</p><p>{[detail.city,detail.state,detail.country].filter(Boolean).join(', ')}</p>
    <p className="ccx-profile-bio">{detail.bio||'No biography shared yet.'}</p>
    {detail.age_verified&&<p>Age verification: current</p>}
    <h4>Shared professional links</h4>
    <div className="ccx-profile-links">{Object.entries(links).filter(([,url])=>validateWorkLink(url)).map(([label,url])=><a key={label} href={String(url)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{label}</a>)}</div>
    {!Object.entries(links).some(([,url])=>validateWorkLink(url))&&<p>No links are available under your current membership and this member’s sharing settings.</p>}
    <p className="ccx-widget-note">Private galleries, legal identity and health records are not part of this public professional profile.</p>
    <button type="button" className="ccx-widget-link" onClick={()=>{setSelected(null);onNavigate('directory');}}>Open Discovery for connection and favorite tools</button>
   </>}
  </dialog>}
 </div>;
}
