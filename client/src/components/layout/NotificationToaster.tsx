'use client';

import React, { useEffect, useState } from 'react';
import { useFlightStore } from '../../store';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

export function NotificationToaster() {
  const [isOnline, setIsOnline] = useState(true);
  const [showNetworkToast, setShowNetworkToast] = useState(false);
  const { offlineDrafts, syncStatus, syncErrorMessage } = useFlightStore();

  useEffect(() => {
    // Monitor Online Status
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      setShowNetworkToast(true);
      // Auto-hide after 5 seconds
      setTimeout(() => setShowNetworkToast(false), 5000);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      
      {/* Network Connectivity Change Toast */}
      {showNetworkToast && (
        <div className={`p-4 rounded-2xl glass-panel shadow-2xl border-white/5 pointer-events-auto flex items-center justify-between animate-slide-up ${
          isOnline ? 'border-emerald-500/20' : 'border-red-500/20'
        }`}>
          <div className="flex items-center space-x-3">
            {isOnline ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wifi className="h-4.5 w-4.5" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                <WifiOff className="h-4.5 w-4.5 animate-pulse" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-white">
                {isOnline ? 'Network Restored' : 'Connection Lost'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOnline ? 'You are back online. Ready to sync.' : 'Switched to safe offline local storage mode.'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowNetworkToast(false)}
            className="text-slate-500 hover:text-white p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sync Status Notifications */}
      {syncStatus === 'syncing' && (
        <div className="p-4 rounded-2xl glass-panel shadow-2xl border-primary-500/20 pointer-events-auto flex items-center space-x-3 animate-slide-up">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
            <RefreshCw className="h-4.5 w-4.5 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Synchronizing Bookings</p>
            <p className="text-xs text-slate-400 mt-0.5">Pushing offline drafts to transaction server...</p>
          </div>
        </div>
      )}

      {syncStatus === 'success' && (
        <div className="p-4 rounded-2xl glass-panel shadow-2xl border-emerald-500/20 pointer-events-auto flex items-center space-x-3 animate-slide-up">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Sync Completed Successfully</p>
            <p className="text-xs text-slate-400 mt-0.5">All offline draft bookings are verified and locked.</p>
          </div>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="p-4 rounded-2xl glass-panel shadow-2xl border-red-500/20 pointer-events-auto flex items-start justify-between animate-slide-up">
          <div className="flex items-start space-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 mt-0.5">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Sync Rejection</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {syncErrorMessage || 'Double booking occurred. Re-select seat assignments.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Offline Pending Prompts */}
      {offlineDrafts.length > 0 && syncStatus === 'idle' && (
        <div className="p-4 rounded-2xl glass-panel shadow-2xl border-amber-500/20 pointer-events-auto flex items-start justify-between animate-slide-up">
          <div className="flex items-start space-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
              <WifiOff className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Pending Offline Drafts</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                You have {offlineDrafts.length} ticket drafts saved locally. 
                <Link href="/my-bookings?sync=true" className="text-primary-400 hover:text-primary-300 font-bold underline ml-1 pointer-events-auto">
                  Sync now
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
