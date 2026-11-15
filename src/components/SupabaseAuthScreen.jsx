import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { requireSupabase } from '@/api/supabaseClient';

function safeReturnTo(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function SupabaseAuthScreen() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const client = requireSupabase();
      const result = mode === 'signup'
        ? await client.auth.signUp({ email: email.trim(), password })
        : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        setNotice('Account created. Check your email if confirmation is required, then sign in.');
      } else {
        window.location.assign(returnTo);
      }
    } catch (submitError) {
      setError(submitError.message || 'Unable to complete authentication.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050817] px-4 py-12 text-white sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-10 flex items-center justify-center gap-3 text-sm text-white/70 transition hover:text-white">
          <img src="/content_connect_logo.png" alt="Content Connect X" className="h-10 w-10 rounded-xl" />
          <span className="font-semibold">Content Connect X</span>
        </Link>
        <section className="rounded-3xl border border-[#00D9FF]/25 bg-[#0C1329]/95 p-6 shadow-[0_0_60px_rgba(255,0,200,0.14)] sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00D9FF] to-[#FF00C8] shadow-[0_0_28px_rgba(255,0,200,0.35)]">
              {mode === 'login' ? <LockKeyhole className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
            </div>
            <h1 className="text-3xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">{mode === 'login' ? 'Sign in to continue creating with confidence.' : 'Join the verified collaboration network.'}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border border-white/15 bg-[#060B1A] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-[#00D9FF] focus:ring-2 focus:ring-[#00D9FF]/20" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label className="block text-sm font-medium">Password<input className="mt-2 w-full rounded-xl border border-white/15 bg-[#060B1A] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-[#00D9FF] focus:ring-2 focus:ring-[#00D9FF]/20" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
            {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF00C8] px-4 py-3.5 font-semibold text-white shadow-[0_0_24px_rgba(255,0,200,0.3)] transition hover:bg-[#FF2BD4] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}{!busy && <ArrowRight className="h-4 w-4" />}</button>
          </form>
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }} className="mt-6 w-full text-center text-sm text-[#63E9FF] transition hover:text-white">{mode === 'login' ? 'New here? Create a free account' : 'Already have an account? Sign in'}</button>
        </section>
      </div>
    </main>
  );
}
