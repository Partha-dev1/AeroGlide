'use client';

/**
 * ============================================================
 * RESET PASSWORD PAGE — AeroGlide Platform
 * ============================================================
 * Displayed after user clicks the password reset link in email.
 * Supabase injects a session into the URL — we use it to
 * call updateUser({ password }) and save the new password.
 * ============================================================
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { authService } from '../../../services/auth/authService';
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // ── Restore session from URL hash on mount ─────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();

    // Supabase injects tokens via URL hash (#access_token=...&type=recovery)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      }
    });

    // Also listen for auth events (PASSWORD_RECOVERY specifically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await authService.updatePassword(password);
    setIsSubmitting(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push('/'), 2500);
    } else {
      setError(result.error || 'Failed to update password. Please try again.');
    }
  };

  // ── Success State ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-sm p-8 rounded-3xl glass-panel border border-white/8 flex flex-col items-center text-center space-y-6 shadow-2xl animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Password Updated!</h2>
          <p className="text-sm text-slate-400">
            Your password has been changed successfully. Redirecting…
          </p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm p-8 rounded-3xl glass-panel border border-white/8 flex flex-col items-center space-y-6 shadow-2xl animate-fade-in">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400/20 to-primary-600/20 border border-primary-500/30">
          <Lock className="h-8 w-8 text-primary-400" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white">Set New Password</h2>
          <p className="text-xs text-slate-400">
            {sessionReady
              ? 'Enter your new password below.'
              : 'Verifying your reset link…'}
          </p>
        </div>

        {!sessionReady ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {/* New password */}
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Confirm */}
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
            />

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 font-medium text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
