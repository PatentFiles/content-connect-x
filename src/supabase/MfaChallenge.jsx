/** Sign-in challenge only for accounts that voluntarily enrolled an authenticator. */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
export default function MfaChallenge({onVerified}){
  const [factor,setFactor]=useState('');
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    supabase.auth.mfa.listFactors().then(({data,error})=>{
      if(!active)return;
      if(error){setError(error.message);return;}
      const totp=(data?.totp||[]).find(f=>f.status==='verified');
      if(totp)setFactor(totp.id);
      else setError('No verified authenticator is available for this account. Contact account support.');
    });
    return()=>{active=false;};
  },[]);
  const verify=async(e)=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      const {error:e2}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code:code.trim()});
      if(e2)throw e2;
      onVerified();
    }catch(e3){setError(e3.message);}finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-[var(--cc-surface-subtle)] text-[var(--cc-text-primary)] grid place-items-center p-4"><div className="w-full max-w-md bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] rounded-xl p-6 space-y-4">
    <h1 className="text-xl font-bold">Verify your authenticator</h1>
    <p className="text-sm text-[var(--cc-text-secondary)]">Your account requires a second authentication factor before accessing Content Connect X.</p>
    {error&&<p role="alert" className="bg-red-50 text-red-800 rounded-lg p-3 text-sm">{error}</p>}
    <form onSubmit={verify} className="space-y-3"><label className="block text-sm">Six-digit code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="w-full mt-1 bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] p-3 rounded-lg" value={code} onChange={e=>setCode(e.target.value)}/></label><button disabled={busy||!factor} className="ccx-action-primary text-[var(--cc-text-primary)] rounded-lg px-4 py-2 w-full font-semibold">Verify</button></form>
    <button className="text-sm text-[var(--cc-text-secondary)]" onClick={()=>supabase.auth.signOut()}>Sign out instead</button>
  </div></main>;
}
