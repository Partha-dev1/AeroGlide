'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore } from '../../store';
import { Plane, Calendar, ArrowRight, Clock, Shield, ChevronRight, Tag } from 'lucide-react';
import { formatCurrency, formatDateFriendly, formatDateTime } from '../../utils';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { AlertBanner } from '../ui/AlertBanner';

export function FlightResultsGrid() {
  const router = useRouter();
  const { searchResults, searchQuery, isSearching, searchError, setActiveFlight } = useFlightStore();

  const handleSelectFlight = (flight: any) => {
    setActiveFlight(flight);
    router.push('/seats');
  };

  const getDuration = (dep: string, arr: string) => {
    const durationMs = new Date(arr).getTime() - new Date(dep).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Route Info Banner */}
      {searchQuery && (
        <div className="mb-8 p-6 rounded-2xl glass-panel border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
              <Plane className="h-6 w-6 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center space-x-2 text-lg font-bold text-white">
                <span>{searchQuery.origin}</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
                <span>{searchQuery.destination}</span>
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1 flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDateFriendly(searchQuery.date)}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white transition"
          >
            Change Route
          </button>
        </div>
      )}

      {/* Main Results Container */}
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Available Flights ({searchResults.length})
      </h3>

      {/* SKELETON LOADERS */}
      {isSearching && (
        <div className="space-y-4">
          <SkeletonLoader variant="card" count={3} />
        </div>
      )}

      {/* ERROR STATE */}
      {searchError && (
        <AlertBanner type="error" message={searchError} />
      )}

      {/* EMPTY STATE */}
      {!isSearching && !searchError && searchResults.length === 0 && (
        <div className="glass-panel rounded-3xl p-12 text-center border-white/5 max-w-xl mx-auto mt-8 flex flex-col items-center">
          <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-4">
            <Plane className="h-8 w-8" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">No Scheduled Flights</h4>
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">
            We currently don't have scheduled services matching your route. Try switching airports or changing dates.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg transition"
          >
            Go Back
          </button>
        </div>
      )}

      {/* FLIGHT LIST CARDS */}
      {!isSearching && !searchError && searchResults.length > 0 && (
        <div className="space-y-4">
          {searchResults.map((flight) => (
            <div 
              key={flight.id} 
              className="glass-panel glass-panel-hover rounded-2xl border-white/5 p-5 sm:p-6 flex flex-col justify-between transition-all"
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 mb-4 gap-2">
                <div className="flex items-center space-x-3">
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-xs font-bold text-primary-400">
                    {flight.flight_number}
                  </span>
                  <span className="text-sm font-semibold text-slate-300">
                    {flight.airline}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-medium">
                  <Shield className="h-3.5 w-3.5 text-primary-500" />
                  <span>{flight.aircraft_type}</span>
                </div>
              </div>

              {/* Card Main Body */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center">
                
                {/* Flight Times & Routes */}
                <div className="md:col-span-5 grid grid-cols-3 items-center justify-items-center">
                  
                  {/* Origin */}
                  <div className="justify-self-start text-left">
                    <p className="text-2xl sm:text-3xl font-extrabold text-white">{formatTime(flight.departure_time)}</p>
                    <p className="text-xs font-bold text-slate-400 tracking-wider mt-1">{flight.origin}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDateFriendly(flight.departure_time)}</p>
                  </div>

                  {/* Duration Slider */}
                  <div className="w-full flex flex-col items-center justify-center">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center space-x-1 mb-1">
                      <Clock className="h-3 w-3" />
                      <span>{getDuration(flight.departure_time, flight.arrival_time)}</span>
                    </span>
                    <div className="w-full flex items-center justify-center">
                      <div className="h-0.5 w-full bg-slate-800 rounded relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary-500 border border-slate-950"></div>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-primary-400 uppercase tracking-widest mt-1">Non-Stop</span>
                  </div>

                  {/* Destination */}
                  <div className="justify-self-end text-right">
                    <p className="text-2xl sm:text-3xl font-extrabold text-white">{formatTime(flight.arrival_time)}</p>
                    <p className="text-xs font-bold text-slate-400 tracking-wider mt-1">{flight.destination}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDateFriendly(flight.arrival_time)}</p>
                  </div>

                </div>

                {/* Price & Selection */}
                <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 flex md:flex-col items-center justify-between md:justify-center md:items-end gap-2">
                  <div className="text-left md:text-right">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      <span>Base Fare</span>
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                      {formatCurrency(flight.base_price)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectFlight(flight)}
                    className="flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20 hover:scale-[1.03] transition-all"
                  >
                    <span>Select Cabin</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
