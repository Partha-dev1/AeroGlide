'use client';

import React from 'react';
import { Plane } from 'lucide-react';

export function FooterSection() {
  return (
    <footer className="w-full border-t border-white/5 bg-slate-950/40 py-8 mt-auto backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-2 text-slate-400 text-sm">
          <Plane className="h-4 w-4 text-primary-500 -rotate-45" />
          <span>© {new Date().getFullYear()} AeroGlide Flight Systems. All rights reserved.</span>
        </div>
        <div className="flex items-center space-x-6 text-xs text-slate-500">
          <span className="hover:text-primary-400 transition cursor-pointer">Supabase Realtime Sync</span>
          <span className="hover:text-primary-400 transition cursor-pointer">Next.js 14 Production Suite</span>
          <span className="hover:text-primary-400 transition cursor-pointer">Zustand Slices</span>
        </div>
      </div>
    </footer>
  );
}
