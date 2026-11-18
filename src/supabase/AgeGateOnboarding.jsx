/** Persistent signup step: only a server-owned admission row unlocks the app. */
import React,{useState} from 'react';
import {LogOut} from 'lucide-react';
import YotiVerification from './YotiVerification';
export default function AgeGateOnboarding({onReload,onSignOut}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const logout=async()=>{setBusy(true);try{await onSignOut();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <main role="dialog" aria-modal="true" aria-label="Complete account age verification" className="ccx-app fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[var(--cc-surface-subtle)] px-4 py-8 text-[var(--cc-text-primary)]">
  <div className="w-full max-w-md">
   <YotiVerification onApproval={onReload} onboarding/>
   {error&&<p role="alert" className="mt-3 text-center text-sm text-red-800">{error}</p>}
   <button type="button" onClick={logout} disabled={busy} className="mx-auto mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm text-[var(--cc-text-secondary)] hover:text-[var(--cc-text-primary)]"><LogOut size={16}/>Sign out and finish later</button>
  </div>
 </main>;
}
