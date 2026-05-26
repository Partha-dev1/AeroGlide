'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore, useFlightStore } from '../../store';
import { Plane, LogIn, LogOut, Ticket, Search, WifiOff, RefreshCw, Menu, X, User } from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';

export function NavbarHeader() {
  const pathname = usePathname();
  const { userId, userName, logoutUser } = useUserStore();
  const { offlineDrafts, syncStatus } = useFlightStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Note: Auth is initialized by AuthProvider in layout.tsx.
  // No initializeAuth call needed here.

  // Close mobile menu on path changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 group-hover:scale-110 group-hover:shadow-blue-500/40">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 opacity-0 blur transition-all duration-300 group-hover:opacity-60"></div>
              <svg className="relative h-7 w-7 -rotate-45 text-white transition-transform duration-500 group-hover:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-2xl font-black tracking-tight leading-none text-white transition-colors duration-300 group-hover:text-cyan-400">
                Aero<span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Glide</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">India Network</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link 
              id="search-nav-link"
              href="/" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') ? 'text-primary-400 bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span>Search Flights</span>
              </span>
            </Link>
            
            <Link 
              id="bookings-nav-link"
              href="/my-bookings" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/my-bookings') ? 'text-primary-400 bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center space-x-2">
                <Ticket className="h-4 w-4" />
                <span>My Bookings</span>
              </span>
            </Link>

            {userId && (
              <Link 
                id="profile-nav-link"
                href="/profile" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/profile') ? 'text-primary-400 bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </span>
              </Link>
            )}
          </nav>

          {/* Desktop Right Hand Control panel */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Offline Draft Badge */}
            {offlineDrafts.length > 0 && (
              <Link 
                href="/my-bookings?sync=true"
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse-subtle"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span>{offlineDrafts.length} Pending Sync</span>
                {syncStatus === 'syncing' && <RefreshCw className="h-3 w-3 animate-spin ml-1" />}
              </Link>
            )}

            {userId ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-slate-300">
                  Welcome, <span className="text-white font-semibold">{userName}</span>
                </span>
                <button
                  id="logout-nav-btn"
                  onClick={logoutUser}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                id="login-nav-btn"
                onClick={() => setShowLoginModal(true)}
                className="flex items-center space-x-2 px-4.5 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button (Hamburger) */}
          <div className="flex md:hidden items-center space-x-2">
            {offlineDrafts.length > 0 && (
              <Link 
                href="/my-bookings?sync=true"
                className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20"
                aria-label="Offline drafts pending sync"
              >
                <WifiOff className="h-4 w-4" />
              </Link>
            )}
            
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition"
              aria-label="Toggle Mobile Menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Collapsible Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-slate-950 p-4 space-y-3 animate-slide-down">
            <Link 
              href="/" 
              className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-semibold transition ${
                isActive('/') ? 'text-primary-400 bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/3'
              }`}
            >
              <Search className="h-4 w-4" />
              <span>Search Flights</span>
            </Link>
            
            <Link 
              href="/my-bookings" 
              className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-semibold transition ${
                isActive('/my-bookings') ? 'text-primary-400 bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/3'
              }`}
            >
              <Ticket className="h-4 w-4" />
              <span>My Bookings</span>
            </Link>

            {userId && (
              <Link 
                href="/profile" 
                className={`flex items-center space-x-3 p-3 rounded-xl text-sm font-semibold transition ${
                  isActive('/profile') ? 'text-primary-400 bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/3'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Profile Settings</span>
              </Link>
            )}

            <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
              {userId ? (
                <>
                  <div className="px-3 py-1 text-xs font-medium text-slate-400">
                    Signed in as <span className="text-slate-200 font-semibold">{userName}</span>
                  </div>
                  <button
                    onClick={() => {
                      logoutUser();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center space-x-3 p-3 rounded-xl text-sm font-semibold border border-white/10 text-rose-400 hover:bg-rose-500/5 hover:border-rose-500/20 transition"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowLoginModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center space-x-3 p-3 rounded-xl text-sm font-bold bg-primary-500 hover:bg-primary-600 text-white transition shadow-lg shadow-primary-500/10"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login / Register</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Modern Authentication Modal */}
      <AuthModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  );
}
