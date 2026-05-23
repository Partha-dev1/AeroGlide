'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore, useUserStore } from '../../store';
import { CheckCircle2, Ticket, Plane, Barcode, ChevronRight, Mail, Armchair } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils';
import Link from 'next/link';

export function BookingConfirmationReceipt() {
  const router = useRouter();
  const { lastCreatedBooking, resetBookingFlow } = useFlightStore();
  const { lookupBookingAndCache } = useUserStore();
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!lastCreatedBooking) {
      router.push('/');
      return;
    }

    const fetchConfirmedBooking = async () => {
      const details = await lookupBookingAndCache(
        lastCreatedBooking.booking_reference,
        // Grab email from flightStore state
        useFlightStore.getState().contactEmail
      );
      if (details) {
        setBookingDetails(details);
      }
      setIsLoading(false);
    };

    fetchConfirmedBooking();

    // Reset booking state only when unmounting the confirmation page
    return () => {
      resetBookingFlow();
    };
  }, [lastCreatedBooking, router, lookupBookingAndCache, resetBookingFlow]);

  if (!lastCreatedBooking) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="h-12 w-12 border-4 border-t-primary-500 border-white/10 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-semibold">Generating boarding assets...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-12 flex flex-col items-center">
      
      {/* Success Visual Animation Header */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20">
          <CheckCircle2 className="h-10 w-10 animate-pulse" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white">Booking Confirmed!</h2>
        <p className="text-sm text-slate-400 mt-2">
          Your flights have been locked. A confirmation receipt has been sent to your email.
        </p>
      </div>

      {/* Boarding Pass Ticket Design Wrapper */}
      {bookingDetails && (
        <div className="w-full rounded-3xl overflow-hidden glass-panel border-white/5 shadow-2xl animate-slide-up relative">
          
          {/* Top colored stripe */}
          <div className="h-2 w-full bg-gradient-to-r from-primary-400 to-indigo-500"></div>

          {/* Ticket Header (PNR & Route) */}
          <div className="p-6 border-b border-dashed border-white/10 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
            <div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Booking Reference (PNR)</p>
              <p className="text-2xl font-black tracking-widest text-primary-400 mt-1">{bookingDetails.booking_reference}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Route Schedule</p>
              <p className="text-base font-bold text-white mt-1">
                {bookingDetails.flight?.origin} ➔ {bookingDetails.flight?.destination}
              </p>
            </div>
          </div>

          {/* Ticket Body: Flight Timing Details */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-b border-white/5">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Departure</p>
              <p className="text-lg font-extrabold text-white">{new Date(bookingDetails.flight?.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(bookingDetails.flight?.departure_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <p className="text-xs font-bold text-slate-500 mt-0.5">{bookingDetails.flight?.origin} Airport</p>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-400 mb-1.5">
                {bookingDetails.flight?.flight_number}
              </span>
              <Plane className="h-5 w-5 text-primary-400 -rotate-45" />
              <span className="text-[10px] text-slate-500 font-bold mt-1.5 capitalize">
                {bookingDetails.flight?.airline}
              </span>
            </div>
            <div className="md:text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Arrival</p>
              <p className="text-lg font-extrabold text-white">{new Date(bookingDetails.flight?.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(bookingDetails.flight?.arrival_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <p className="text-xs font-bold text-slate-500 mt-0.5">{bookingDetails.flight?.destination} Airport</p>
            </div>
          </div>

          {/* Ticket Body: Passengers & Seats info */}
          <div className="p-6 border-b border-white/5 space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Traveler Assignments</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bookingDetails.passengers?.map((p: any, idx: number) => (
                <div key={p.id || idx} className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-7 w-7 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{p.first_name} {p.last_name}</p>
                      <p className="text-[9px] text-slate-500 capitalize">{p.seat?.class} Cabin</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-primary-500/10 border border-primary-500/20 text-xs font-bold text-primary-400">
                      <Armchair className="h-3 w-3" />
                      <span>{p.seat?.seat_code}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket Footer (Contact, Price, Receipt) */}
          <div className="p-6 bg-slate-950/30 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Mail className="h-4 w-4 text-primary-500" />
              <span>Email: <span className="text-white font-semibold">{bookingDetails.contact_email}</span></span>
            </div>
            
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Charged</span>
              <span className="text-xl font-black text-white">{formatCurrency(Number(bookingDetails.total_price))}</span>
            </div>
          </div>

          {/* visual Boarding Pass Barcode */}
          <div className="p-6 border-t border-dashed border-white/10 flex flex-col items-center justify-center bg-slate-950/60 text-slate-500">
            <Barcode className="h-14 w-full max-w-[280px] shrink-0 text-slate-400" />
            <p className="text-[9px] font-mono tracking-widest text-slate-400 mt-2">PNR-{bookingDetails.booking_reference}-SECURED</p>
          </div>

        </div>
      )}

      {/* Button Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full mt-10">
        <Link 
          href="/my-bookings" 
          className="w-full sm:w-1/2 py-3.5 rounded-xl font-bold border border-white/10 hover:border-white/20 text-slate-300 hover:text-white hover:bg-white/5 text-center flex items-center justify-center space-x-2 transition"
        >
          <Ticket className="h-4 w-4" />
          <span>My Dashboard</span>
        </Link>
        <Link 
          href="/" 
          className="w-full sm:w-1/2 py-3.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg text-center flex items-center justify-center space-x-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          <span>Book Another Flight</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

    </div>
  );
}
