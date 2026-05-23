'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore } from '../../store';
import { SeatMapCabinGrid } from '../seat-map/SeatMapCabinGrid';
import { Plane, Armchair, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { AuthModal } from '../auth/AuthModal';

export function SeatSelectionCabin() {
  const router = useRouter();
  const { 
    activeFlight, 
    selectedSeats, 
    toggleSeatSelection, 
    lockSession, 
    initLockSession, 
    lockSelectedSeats,
    bookingError,
    userId
  } = useFlightStore();

  const [isLocking, setIsLocking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Initialize lock session token on mount
  useEffect(() => {
    if (!activeFlight) {
      router.push('/');
      return;
    }
    initLockSession();
  }, [activeFlight]);

  // Auto-proceed once authenticated if they clicked lock-seats
  useEffect(() => {
    if (userId && showAuthModal) {
      setShowAuthModal(false);
      handleProceed();
    }
  }, [userId, showAuthModal]);

  if (!activeFlight) return null;

  // Compute ticket costs
  const calculateSeatPrice = (multiplier: number) => {
    return activeFlight.base_price * multiplier;
  };

  const totalTicketPrice = selectedSeats.reduce((acc, seat) => {
    return acc + calculateSeatPrice(seat.price_multiplier);
  }, 0);

  const handleProceed = async () => {
    if (selectedSeats.length === 0) {
      setLocalError('Please select at least one seat to continue.');
      return;
    }

    setLocalError(null);

    if (!userId) {
      setShowAuthModal(true);
      return;
    }

    setIsLocking(true);

    const success = await lockSelectedSeats();
    setIsLocking(false);

    if (success) {
      router.push('/booking');
    }
  };


  return (
    <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Step Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Select Your Cabin Seats</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1.5 font-medium">
            <Plane className="h-3.5 w-3.5 -rotate-45" />
            <span>Flight {activeFlight.flight_number} • {activeFlight.origin} to {activeFlight.destination}</span>
          </p>
        </div>
        <span className="hidden sm:inline px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-900 border border-white/10 text-primary-400">
          Step 1 of 3
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Seat Map Visualizer Grid (Left Columns) */}
        <div className="lg:col-span-2 flex flex-col items-center">
          <SeatMapCabinGrid 
            flightId={activeFlight.id}
            selectedSeats={selectedSeats}
            onSeatToggle={toggleSeatSelection}
            lockSession={lockSession}
          />
        </div>

        {/* Selected Summary Panel (Right Column) */}
        <div className="lg:col-span-1 space-y-6 sticky top-24">
          <div className="glass-panel rounded-3xl p-6 border-white/5 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-3">
              Booking Summary
            </h3>

            {selectedSeats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-3">
                  <Armchair className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-white">No Seats Selected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                  Click on an available seat in the map to make a selection.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Selected Seats List */}
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {selectedSeats.map((seat) => (
                    <div 
                      key={seat.id} 
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-lg bg-primary-500/10 text-primary-400 flex items-center justify-center font-bold text-sm">
                          {seat.seat_code}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white capitalize">{seat.class} Class</p>
                          <p className="text-[10px] text-slate-400">Multiplier: {seat.price_multiplier}x</p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-white">
                        {formatCurrency(calculateSeatPrice(seat.price_multiplier))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-white/5 pt-4">
                  {/* Total Calculations */}
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Base Ticket Fare</span>
                    <span>{formatCurrency(activeFlight.base_price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-white font-extrabold text-lg mt-3 pt-3 border-t border-white/5">
                    <span>Total Fare</span>
                    <span className="text-primary-400">{formatCurrency(totalTicketPrice)}</span>
                  </div>
                </div>

              </div>
            )}

            {/* Error alerts */}
            {(localError || bookingError) && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{localError || bookingError}</span>
              </div>
            )}

            {/* Hold Notification Alert */}
            {selectedSeats.length > 0 && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[10px] text-amber-400 leading-relaxed">
                ⚠️ Click below to temporarily lock these seats. Once locked, you will have 10 minutes to complete checkout.
              </div>
            )}

            {/* checkout Proceed Button */}
            <button
              onClick={handleProceed}
              disabled={isLocking || selectedSeats.length === 0}
              className="w-full mt-6 py-3.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              {isLocking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Locking Seats...</span>
                </>
              ) : (
                <>
                  <span>Lock Seats & Continue</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Auth Modal Mount */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

    </div>
  );
}

