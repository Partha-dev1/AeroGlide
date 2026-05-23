'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore, useUserStore } from '../../store';
import { Plane, Contact, ShieldCheck, Armchair, ChevronRight, AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { validateContactDetails, validatePassengers } from '../../validators/bookingValidationSchema';
import { formatCurrency } from '../../utils';

export function PassengerDetailsForm() {
  const router = useRouter();
  const { userId } = useUserStore();
  const { 
    activeFlight, 
    selectedSeats, 
    contactEmail, 
    contactPhone,
    updateContactDetails,
    updatePassengerDetails,
    setPassportInMemory,
    passportEntries,
    createBooking,
    saveBookingAsOfflineDraft,
    bookingError,
    resetBookingFlow,
    holdTimeRemaining,
    decrementHoldTime
  } = useFlightStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Local Passenger Names State (to map to store)
  const [passengerNames, setPassengerNames] = useState<Record<string, { first: string; last: string }>>({});
  const [emailInput, setEmailInput] = useState(contactEmail);
  const [phoneInput, setPhoneInput] = useState(contactPhone);

  useEffect(() => {
    if (!activeFlight || selectedSeats.length === 0) {
      router.push('/');
    }
  }, [activeFlight, selectedSeats, router]);

  // Realtime hold lock countdown ticker
  useEffect(() => {
    if (holdTimeRemaining > 0) {
      const interval = setInterval(() => {
        decrementHoldTime();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [holdTimeRemaining, decrementHoldTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeFlight) return null;

  const handleNameChange = (seatId: string, field: 'first' | 'last', val: string) => {
    setPassengerNames(prev => ({
      ...prev,
      [seatId]: {
        ...prev[seatId] || { first: '', last: '' },
        [field]: val
      }
    }));
  };

  const handlePassportChange = (seatId: string, val: string) => {
    setPassportInMemory(seatId, val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validate Contact Info
    const contactValidation = validateContactDetails(emailInput, phoneInput);
    if (!contactValidation.isValid) {
      const errorMsg = Object.values(contactValidation.errors).join(' ');
      setFormError(errorMsg);
      return;
    }

    // Prepare lists
    const passengersList = selectedSeats.map(seat => {
      const names = passengerNames[seat.id] || { first: '', last: '' };
      return {
        first_name: names.first,
        last_name: names.last,
        seat_id: seat.id,
      };
    });

    // 2. Validate Passenger details & in-memory passport entries
    const passengerValidation = validatePassengers(passengersList, passportEntries, true);
    if (!passengerValidation.isValid) {
      const errorsList = passengerValidation.errors || [];
      const err = errorsList.find(x => x && (x.first_name || x.last_name || x.passport_number));
      const errorMsg = err 
        ? (err.first_name || err.last_name || err.passport_number || 'Validation failed.')
        : 'Please fill in all passenger details and passport numbers.';
      setFormError(errorMsg);
      return;
    }

    // Save contact and names in store
    updateContactDetails(emailInput, phoneInput);
    updatePassengerDetails(passengersList);

    // --- CHECK NETWORK STATUS ---
    const isOnline = navigator.onLine;

    if (!isOnline) {
      // Switched Offline: Save Booking Draft securely
      saveBookingAsOfflineDraft(userId);
      alert('📡 Network offline. Your seat selections and details have been securely cached as local draft. Sync it in your My Bookings dashboard once you are back online!');
      resetBookingFlow();
      router.push('/my-bookings');
      return;
    }

    // Proceed with server booking
    setIsSubmitting(true);
    const success = await createBooking(userId);
    setIsSubmitting(false);

    if (success) {
      router.push('/confirmation');
    }
  };

  const handleForceOfflineDraft = () => {
    const passengersList = selectedSeats.map(seat => {
      const names = passengerNames[seat.id] || { first: '', last: '' };
      return {
        first_name: names.first,
        last_name: names.last,
        seat_id: seat.id,
      };
    });

    updateContactDetails(emailInput, phoneInput);
    updatePassengerDetails(passengersList);
    saveBookingAsOfflineDraft(userId);
    
    alert('💾 Simulated offline mode: Booking saved as draft in localStorage (without passport numbers) to test reconciliation features.');
    resetBookingFlow();
    router.push('/my-bookings');
  };

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Realtime Hold Lock Countdown Banner */}
      {holdTimeRemaining > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between shadow-lg shadow-amber-500/5 animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-semibold">Seat reservation locked. It is temporarily held for you.</span>
          </div>
          <div className="flex items-center space-x-2 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-500/30">
            <span className="font-bold text-amber-400 font-mono tracking-wider">{formatTime(holdTimeRemaining)}</span>
            <span className="text-[10px] text-amber-500 uppercase tracking-widest font-medium">remaining</span>
          </div>
        </div>
      )}

      {/* Step Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Passenger & Ticket Details</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1.5 font-medium">
            <Plane className="h-3.5 w-3.5 -rotate-45" />
            <span>Flight {activeFlight.flight_number} • {activeFlight.origin} to {activeFlight.destination}</span>
          </p>
        </div>
        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-900 border border-white/10 text-primary-400">
          Step 2 of 3
        </span>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Main Form Fields (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Secured checkout details alert */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-slate-300 flex items-start space-x-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">Secure Transaction Protocol</p>
              <p className="leading-relaxed text-slate-400">
                To guarantee absolute user privacy, passport numbers are handled in-memory and will never be saved in local storage.
              </p>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Contact className="h-4.5 w-4.5 text-primary-400" />
              <span>Contact Information</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="form-input text-sm h-11"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="form-input text-sm h-11"
                />
              </div>
            </div>
          </div>

          {/* Passenger Information Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">
              Passenger Declarations ({selectedSeats.length})
            </h3>

            {selectedSeats.map((seat, index) => {
              const names = passengerNames[seat.id] || { first: '', last: '' };
              const passport = passportEntries[seat.id] || '';

              return (
                <div key={seat.id} className="glass-panel rounded-3xl p-6 border-white/5 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-6 bg-slate-900 border-b border-l border-white/5 flex items-center justify-center text-[10px] font-bold text-primary-400 rounded-bl-xl">
                    Seat {seat.seat_code}
                  </div>

                  <div className="flex items-center space-x-2 text-sm font-bold text-white mb-2">
                    <span className="h-6 w-6 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span>Passenger {index + 1} ({seat.class} seat)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={names.first}
                        onChange={(e) => handleNameChange(seat.id, 'first', e.target.value)}
                        placeholder="John"
                        className="form-input text-sm h-11"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={names.last}
                        onChange={(e) => handleNameChange(seat.id, 'last', e.target.value)}
                        placeholder="Doe"
                        className="form-input text-sm h-11"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Passport Number</span>
                      <span className="text-[10px] text-slate-500 lowercase font-medium">secured in-memory</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={passport}
                      onChange={(e) => handlePassportChange(seat.id, e.target.value)}
                      placeholder="A12345678"
                      className="form-input text-sm h-11 border-primary-500/20"
                    />
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Price Breakdown Panel (Right Column) */}
        <div className="lg:col-span-1 space-y-6 sticky top-24">
          <div className="glass-panel rounded-3xl p-6 border-white/5 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-3">
              Fare Summary
            </h3>

            <div className="space-y-3.5">
              {selectedSeats.map(seat => (
                <div key={seat.id} className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <Armchair className="h-3.5 w-3.5 text-primary-400" />
                    <span className="font-bold text-slate-300">Seat {seat.seat_code}</span>
                    <span className="text-slate-500 capitalize">({seat.class})</span>
                  </div>
                  <span className="font-semibold text-white">
                    {formatCurrency(activeFlight.base_price * seat.price_multiplier)}
                  </span>
                </div>
              ))}

              <div className="border-t border-white/5 pt-4 mt-2">
                <div className="flex items-center justify-between text-white font-extrabold text-lg">
                  <span>Grand Total</span>
                  <span className="text-primary-400">
                    {formatCurrency(selectedSeats.reduce((acc, curr) => acc + (activeFlight.base_price * curr.price_multiplier), 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Error indicators */}
            {(formError || bookingError) && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError || bookingError}</span>
              </div>
            )}

            {/* Complete Transaction CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 py-3.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 flex items-center justify-center space-x-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing Tickets...</span>
                </>
              ) : (
                <>
                  <span>Book Flight Tickets</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>

            {/* Simulated Offline Save Draft Option */}
            <button
              type="button"
              onClick={handleForceOfflineDraft}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold border border-white/5 hover:border-amber-500/30 text-slate-400 hover:text-amber-400 bg-white/5 flex items-center justify-center space-x-1.5 transition"
            >
              <WifiOff className="h-3.5 w-3.5" />
              <span>Simulate Offline Draft</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
