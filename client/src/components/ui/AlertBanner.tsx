'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface AlertBannerProps {
  type?: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

export function AlertBanner({ type = 'info', message, onClose, className = '' }: AlertBannerProps) {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  };

  const Icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const IconComponent = Icons[type];

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 backdrop-blur-sm transition-all duration-300 ${styles[type]} ${className}`}
    >
      <IconComponent className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="flex-1 text-sm font-medium leading-relaxed">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
