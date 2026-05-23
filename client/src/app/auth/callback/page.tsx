'use client';

/**
 * ============================================================
 * AUTH CALLBACK — AeroGlide Platform
 * ============================================================
 * Handles PKCE redirect after email verification / OAuth.
 * Supabase redirects here with code in URL params.
 * Exchanges the code for a session, then redirects to home.
 * ============================================================
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { useStore } from '../../../store';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');
  const isExchangingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (!isSupabaseConfigured) {
        setStatus('error');
        setMessage('Authentication is not configured.');
        return;
      }

      // Extract code first
      const code = new URLSearchParams(window.location.search).get('code');
      if (!code) {
        // If code doesn't exist, check if user is already authenticated
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus('success');
          setMessage('Already signed in! Redirecting…');
          setTimeout(() => router.push('/'), 1500);
        } else {
          setStatus('error');
          setMessage('No authorization code was found in the callback URL.');
        }
        return;
      }

      // Check if this code has already been processed (Zustand persists this across double-mounts)
      const store = useStore.getState();
      const alreadyProcessed = store.processedCodes?.includes(code);

      if (alreadyProcessed || isExchangingRef.current) {
        setStatus('success');
        setMessage('Email verified! Redirecting…');
        setTimeout(() => router.push('/'), 1500);
        return;
      }

      // Guard code exchange
      isExchangingRef.current = true;
      store.addProcessedCode(code);

      try {
        const supabase = getSupabaseClient();

        // 3. Exchange PKCE code exactly once
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          // Fallback: check if session is active (already logged in)
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setStatus('success');
            setMessage('Email verified! Redirecting…');
            setTimeout(() => router.push('/'), 1500);
            return;
          }
          setStatus('error');
          setMessage(error.message || 'Verification failed. Please try again.');
          return;
        }

        setStatus('success');
        setMessage('Email verified successfully! Redirecting…');
        setTimeout(() => router.push('/'), 1500);
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Something went wrong during verification.');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm p-8 rounded-3xl glass-panel border border-white/8 flex flex-col items-center text-center space-y-6 shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
            <p className="text-slate-300 text-sm font-medium">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-emerald-300 text-sm font-semibold">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/30">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <p className="text-red-300 text-sm font-medium">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold transition-all"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
