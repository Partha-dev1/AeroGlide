'use client';

/**
 * ============================================================
 * AUTH GUARD — AeroGlide Platform
 * ============================================================
 * Wraps protected pages/sections.
 * - Shows loading skeleton while session is being initialized
 * - Prevents flash of unauthenticated content (FOUC)
 * - Displays a premium lock screen with sign-in CTA when not authenticated
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';
import { AuthModal } from './AuthModal';

interface AuthGuardProps {
  children: React.ReactNode;
  /** Custom message shown on the lock screen */
  message?: string;
}

export function AuthGuard({
  children,
  message = 'To select seats, complete booking, or access your flight dashboard, please sign in or create a free account.',
}: AuthGuardProps) {
  const { userId, authReady } = useUserStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ── Loading skeleton while session initializes ─────────────────────────
  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <span className="text-sm font-medium">Loading your session…</span>
        </div>
      </div>
    );
  }

  // ── Authenticated — render children ───────────────────────────────────
  if (userId) {
    return <>{children}</>;
  }

  // ── Unauthenticated — lock screen ─────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md p-8 rounded-3xl glass-panel border border-white/8 flex flex-col items-center text-center space-y-6 shadow-2xl animate-fade-in">

        {/* Lock icon */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400/20 to-primary-600/20 border border-primary-500/30 shadow-lg shadow-primary-500/10">
          <ShieldAlert className="h-10 w-10 text-primary-400" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary-500" />
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Authentication Required
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
            {message}
          </p>
        </div>

        {/* CTA buttons */}
        <div className="w-full space-y-3">
          <button
            id="auth-guard-signin-btn"
            onClick={() => setShowAuthModal(true)}
            className="w-full py-3.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 active:scale-[0.98] text-white shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2.5 transition-all"
          >
            <LogIn className="h-4.5 w-4.5" />
            Sign In / Create Account
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
