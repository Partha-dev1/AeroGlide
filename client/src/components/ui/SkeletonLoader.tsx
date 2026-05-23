'use client';

import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'card' | 'line' | 'circle' | 'seats';
  count?: number;
  className?: string;
}

export function SkeletonLoader({ variant = 'line', count = 1, className = '' }: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'circle':
        return <div className={`animate-pulse rounded-full bg-slate-800 ${className}`} />;
      
      case 'card':
        return (
          <div className={`animate-pulse rounded-2xl border border-white/5 bg-slate-900/40 p-6 space-y-4 ${className}`}>
            <div className="h-6 w-1/3 rounded bg-slate-850" />
            <div className="h-4 w-3/4 rounded bg-slate-850" />
            <div className="h-4 w-1/2 rounded bg-slate-850" />
            <div className="pt-4 flex justify-between items-center">
              <div className="h-10 w-24 rounded-lg bg-slate-850" />
              <div className="h-6 w-16 rounded bg-slate-850" />
            </div>
          </div>
        );

      case 'seats':
        return (
          <div className={`animate-pulse rounded-2xl border border-white/5 bg-slate-900/40 p-6 space-y-6 ${className}`}>
            <div className="h-6 w-1/4 mx-auto rounded bg-slate-850" />
            <div className="grid grid-cols-6 gap-2 max-w-sm mx-auto">
              {Array.from({ length: 36 }).map((_, idx) => (
                <div key={idx} className="aspect-square rounded-md bg-slate-850" />
              ))}
            </div>
          </div>
        );

      case 'line':
      default:
        return <div className={`animate-pulse rounded bg-slate-800 h-4 w-full ${className}`} />;
    }
  };

  return (
    <div className="space-y-3 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <React.Fragment key={idx}>{renderSkeleton()}</React.Fragment>
      ))}
    </div>
  );
}
