'use client';

import React, { useEffect, useState } from 'react';
import { Seat } from '../../types';
import { Armchair, Shield, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAeroStore } from '../../store';
import { useSeatSync } from '../../hooks/useSeatSync';

interface SeatMapCabinGridProps {
  flightId: string;
  selectedSeats: Seat[];
  onSeatToggle: (seat: Seat) => void;
  lockSession: string | null;
}

export function SeatMapCabinGrid({ flightId, selectedSeats, onSeatToggle, lockSession }: SeatMapCabinGridProps) {
  // Connect Server-Sent Events real-time sync hook
  useSeatSync(flightId);

  // Bind to unified Zustand stores
  const seats = useAeroStore(state => state.activeFlightSeats);
  const isLoading = useAeroStore(state => state.isLoadingSeats);
  const error = useAeroStore(state => state.bookingError);
  const fetchSeats = useAeroStore(state => state.fetchSeats);
  const activeFlight = useAeroStore(state => state.activeFlight);

  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);

  // Self-heal/ensure seats are loaded if not already fetched
  useEffect(() => {
    if (flightId && seats.length === 0) {
      fetchSeats(flightId);
    }
  }, [flightId, seats.length, fetchSeats]);

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === 'occupied') return;
    if (seat.status === 'locked' && seat.locked_by !== lockSession) return;
    onSeatToggle(seat);
  };

  const getSeatColor = (seat: Seat) => {
    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    const isLockedByMe = seat.status === 'locked' && seat.locked_by === lockSession;
    
    if (isSelected || isLockedByMe) {
      return 'bg-primary-500 text-white border-primary-400 shadow-md shadow-primary-500/30'; 
    }
    
    if (seat.status === 'occupied') {
      return 'bg-slate-800 text-slate-500 border-slate-700/50 cursor-not-allowed'; 
    }
    
    if (seat.status === 'locked') {
      return 'bg-amber-500/20 text-amber-500 border-amber-500/30 cursor-not-allowed'; 
    }

    switch (seat.class) {
      case 'first':
        return 'bg-purple-950/40 text-purple-400 border-purple-500/30 hover:bg-purple-500 hover:text-white hover:border-purple-400';
      case 'business':
        return 'bg-sky-950/40 text-sky-400 border-sky-500/30 hover:bg-sky-500 hover:text-white hover:border-sky-400';
      case 'economy':
      default:
        return 'bg-slate-900/60 text-slate-300 border-white/10 hover:bg-primary-500/20 hover:text-primary-400 hover:border-primary-500/40';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="spinner-ring"></div>
        <p className="text-sm font-medium text-slate-400">Loading cabin seating chart...</p>
      </div>
    );
  }

  if (error && seats.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 border-red-500/20 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mb-2" />
        <p className="text-sm font-semibold text-white">{error}</p>
        <button 
          onClick={() => fetchSeats(flightId)}
          className="mt-3 px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 font-bold transition flex items-center gap-2"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  // Detect aircraft body configuration
  const type = activeFlight?.aircraft_type.toUpperCase() || '';
  const isWideBody = type.includes('777') || type.includes('350') || type.includes('DREAMLINER');

  const columns = isWideBody 
    ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'] 
    : ['A', 'B', 'C', 'D', 'E', 'F'];

  // Extract distinct row numbers present in seats data
  const distinctRows = Array.from(new Set(seats.map(s => parseInt(s.seat_code.replace(/\D/g, ''), 10)))).sort((a, b) => a - b);

  const firstRows = distinctRows.filter(r => {
    const rSeats = seats.filter(s => s.seat_code.startsWith(`${r}`));
    return rSeats.some(s => s.class === 'first');
  });

  const businessRows = distinctRows.filter(r => {
    const rSeats = seats.filter(s => s.seat_code.startsWith(`${r}`));
    return rSeats.some(s => s.class === 'business');
  });

  const economyRows = distinctRows.filter(r => {
    const rSeats = seats.filter(s => s.seat_code.startsWith(`${r}`));
    return rSeats.some(s => s.class === 'economy');
  });

  const renderRow = (rowNum: number) => {
    return (
      <div key={rowNum} className="flex items-center justify-center mb-2 animate-fade-in">
        {/* Row Number */}
        <span className="w-6 text-center text-xs font-semibold text-slate-500 mr-2">{rowNum}</span>
        
        {/* Seats Grid */}
        <div className="flex items-center space-x-1">
          {columns.map((col, index) => {
            const seatCode = `${rowNum}${col}`;
            const seat = seats.find((s) => s.seat_code === seatCode);

            // Spacing calculations for dynamic aisle visual structures
            const isFirstAisle = index === 3; // index 3 = column D (narrow) or column D (wide)
            const isSecondAisle = isWideBody && index === 7; // index 7 = column H

            return (
              <React.Fragment key={col}>
                {isFirstAisle && (
                  <div className="w-6 sm:w-10 h-6 flex items-center justify-center text-[8px] text-slate-600 font-bold uppercase tracking-widest pointer-events-none select-none">
                    Aisle
                  </div>
                )}
                {isSecondAisle && (
                  <div className="w-6 sm:w-10 h-6 flex items-center justify-center text-[8px] text-slate-600 font-bold uppercase tracking-widest pointer-events-none select-none">
                    Aisle
                  </div>
                )}

                {seat ? (
                  <button
                    onClick={() => handleSeatClick(seat)}
                    onMouseEnter={() => setHoveredSeat(seat)}
                    onMouseLeave={() => setHoveredSeat(null)}
                    disabled={seat.status === 'occupied' || (seat.status === 'locked' && seat.locked_by !== lockSession)}
                    aria-label={`Seat ${seatCode}, ${seat.class} class, ${seat.status}`}
                    className={`seat-btn w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl border flex flex-col items-center justify-center text-[9px] font-bold transition-all duration-200 ${getSeatColor(seat)}`}
                  >
                    <Armchair className="h-3 sm:h-4.5 w-3 sm:w-4.5 mb-0.5" />
                    <span>{col}</span>
                  </button>
                ) : (
                  // Placeholder for irregular configurations
                  <div className="w-8 sm:w-10 h-8 sm:h-10 bg-transparent"></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Legend Indicators */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-8 px-4 py-3 rounded-2xl glass-panel text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-purple-950/40 border border-purple-500/40"></div>
          <span className="text-slate-300">First</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-sky-950/40 border border-sky-500/40"></div>
          <span className="text-slate-300">Business</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-slate-900/60 border border-white/10"></div>
          <span className="text-slate-300">Economy</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-slate-800 border border-slate-700/50"></div>
          <span className="text-slate-400">Occupied</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/30"></div>
          <span className="text-amber-400">Locked</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-primary-500 border border-primary-400"></div>
          <span className="text-white font-semibold">Your Selection</span>
        </div>
      </div>

      {/* Floating Seat Tooltip */}
      <div className="h-10 mb-2 flex items-center justify-center">
        {hoveredSeat ? (
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-white flex items-center space-x-2 animate-fade-in">
            <Info className="h-3.5 w-3.5 text-primary-400" />
            <span>Seat {hoveredSeat.seat_code}</span>
            <span className="text-slate-500">•</span>
            <span className="capitalize text-primary-300">{hoveredSeat.class} Class</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">{(hoveredSeat.price_multiplier > 1) ? `+${Math.round((hoveredSeat.price_multiplier - 1) * 100)}% Fee` : 'Base Fare'}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 font-medium">Hover over a seat for ticket details</span>
        )}
      </div>

      {/* Aircraft Seating Container */}
      <div className="w-full max-w-2xl glass-panel rounded-3xl p-4 sm:p-8 border-white/5 relative shadow-2xl overflow-x-auto">
        <div className="min-w-[450px]">
          {/* Cockpit Visual Indicator */}
          <div className="mx-auto w-32 h-14 bg-gradient-to-t from-slate-900 to-slate-950 border-t border-x border-white/10 rounded-t-full mb-8 flex items-center justify-center relative">
            <div className="absolute top-2 w-16 h-1 bg-primary-500/20 rounded-full blur-[2px]"></div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Cockpit</span>
          </div>

          {/* First Class Section */}
          {firstRows.length > 0 && (
            <div className="mb-6">
              <div className="text-center text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center justify-center space-x-2">
                <span>First Class</span>
                <Shield className="h-3 w-3" />
              </div>
              {firstRows.map(renderRow)}
            </div>
          )}

          {firstRows.length > 0 && businessRows.length > 0 && <div className="w-full border-t border-dashed border-white/5 my-4"></div>}

          {/* Business Class Section */}
          {businessRows.length > 0 && (
            <div className="mb-6">
              <div className="text-center text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3">Business Class</div>
              {businessRows.map(renderRow)}
            </div>
          )}

          {businessRows.length > 0 && economyRows.length > 0 && <div className="w-full border-t border-dashed border-white/5 my-4"></div>}

          {/* Economy Class Section */}
          {economyRows.length > 0 && (
            <div>
              <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Economy Class</div>
              {economyRows.map(renderRow)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
