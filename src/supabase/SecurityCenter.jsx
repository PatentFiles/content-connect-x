/** TOTP MFA setup via Supabase Auth. No token or secret is sent to our API. */
import React, { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
const panel='ccx-surface p-5';
const input='w-full rounded-lg border border-[#34445D] bg-[#0F1520] p-2 text-sm';
const button='rounded-lg ccx-action-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
export default function SecurityCenter({isAdmin=false}){
  const [factors,setFactors]=useState([]);
  const [pending,setPending]=useState(null);
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [verifyEnabled,setVerifyEnabled]=useState(null);
  const load=async()=>{
    setBusy(true);setError('');
    try{
      const {data,error:e}=await supabase.auth.mfa.listFactors();if(e)throw e;setFactors(data.totp||[]);
      if(isAdmin){
        const {data:vr}=await supabase.from('age_verification_requests')
          .select('status,expires_at').order('created_at',{ascending:false}).limit(1);
        const latest=vr?.[0];
        setVerifyEnabled(latest?.status==='approved'&&(!latest?.expires_at||Date.parse(latest.expires_at)>Date.now()));
      }
    }
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  useEffect(()=>{load();},[]);
  const enroll=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const {data,error:e}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Content Connect X authenticator'});
      if(e)throw e;
      setPending({id:data.id,qr:data.totp?.qr_code,secret:data.totp?.secret});
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const verify=async(event)=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      const {error:e}=await supabase.auth.mfa.challengeAndVerify({factorId:pending.id,code:code.trim()});
      if(e)throw e;
      setPending(null);setCode('');setNotice('Authenticator enabled successfully.');await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const remove=async(id)=>{
    if(!window.confirm('Disable this authenticator factor? Make sure you have another recovery method.'))return;
    setBusy(true);setError('');
    try{const {error:e}=await supabase.auth.mfa.unenroll({factorId:id});if(e)throw e;setNotice('Factor disabled.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="space-y-4 max-w-3xl"><div className="flex justify-between items-center"><h2 className="text-2xl font-semibold flex gap-2 items-center"><LockKeyhole size={22}/> Account security</h2><button className={button} disabled={busy} onClick={load}><RefreshCw size={16}/></button></div>
    <p className="text-sm text-[#9AA6BC]">Use a time-based authenticator application to secure your account. Never share one-time codes or QR setup secrets.</p>
    {error&&<p role="alert" className="rounded-lg p-3 bg-red-950 text-red-200">{error}</p>}
    {notice&&<p role="status" className="rounded-lg p-3 bg-emerald-950 text-emerald-200">{notice}</p>}
    <div className={panel+' space-y-3'}><h3 className="font-semibold">Authenticator factors</h3>
      {!factors.length&&<p className="text-sm text-[#9AA6BC]">No authenticator enrolled yet.</p>}
      {factors.map(f=><div key={f.id} className="flex items-center justify-between border-b border-[#34445D] py-2 gap-2"><div><p className="font-semibold text-sm">{f.friendly_name||'Authenticator'}</p><p className="text-xs text-[#9AA6BC]">{f.status}</p></div><button className="text-sm text-red-300" disabled={busy} onClick={()=>remove(f.id)}>Remove</button></div>)}
      {!pending&&<button className={button} disabled={busy} onClick={enroll}>Add authenticator</button>}
    </div>
    {pending&&<form className={panel+' space-y-3'} onSubmit={verify}><h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={17}/> Verify authenticator setup</h3>
      <p className="text-sm text-[#9AA6BC]">Scan the QR code in your authenticator app and enter its current six-digit code.</p>
      {pending.qr&&<img src={pending.qr} alt="One-time authenticator QR setup" className="w-48 h-48 bg-white p-3 rounded-lg"/>}
      <label className="text-sm block">Manual setup secret (keep private)<input className={input+' mt-1 font-mono'} value={pending.secret||''} readOnly/></label>
      <label className="text-sm block">Authenticator code<input className={input+' mt-1'} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required autoComplete="one-time-code"/></label>
      <button className={button} disabled={busy}>Verify and enable MFA</button>
    </form>}
    <p className="text-xs text-[#9AA6BC]">MFA protects sign-in. Access to personal documents, medical clearance, and contracts is still restricted by separate backend authorization checks.</p>
    {isAdmin&&<div className={panel+' space-y-3'}>
      <h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={17}/>Admin verification toggle (testing)</h3>
      <p className="text-sm text-[#9AA6BC]">As an admin, you can toggle your own age verification on or off for testing the verification flow. Turning it off removes your verification so you can test the full signup and verification experience.</p>
      <button type="button" className="flex items-center gap-3 text-sm font-medium" disabled={busy||verifyEnabled===null} onClick={async()=>{
        setBusy(true);setError('');setNotice('');
        try{
          const next=!verifyEnabled;
          const {data,error:rpcError}=await supabase.rpc('admin_toggle_self_verification',{p_enable:next});
          if(rpcError)throw rpcError;
          setVerifyEnabled(next);
          setNotice(next?'Verification enabled — you are now approved.':'Verification disabled — you can now test the verification flow.');
        }catch(e){setError(e.message);}finally{setBusy(false);}
      }}>
        {verifyEnabled?<ToggleRight size={32} className="text-emerald-400"/>:<ToggleLeft size={32} className="text-[#7A8BA5]"/>}
        <span>{verifyEnabled===null?'Loading…':verifyEnabled?'Age verification is ON (approved)':'Age verification is OFF'}</span>
      </button>
    </div>}
  </div>;
}
