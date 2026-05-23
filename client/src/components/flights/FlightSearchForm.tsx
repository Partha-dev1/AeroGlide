'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore } from '../../store';
import { Calendar, Search, ShieldCheck, Compass, Sparkles, MapPin, Plane, AlertCircle, ChevronRight } from 'lucide-react';
import { AirportSelector } from '../airport/AirportSelector';
import { NearbyAirportsList } from '../airport/NearbyAirportsList';
import { AirportDetailsPanel } from '../airport/AirportDetailsPanel';
import { FlightProgressTracker } from '../tracking/FlightProgressTracker';
import { airportSearchService } from '../../services/airportSearchService';
import { Airport } from '../../types';

// Popular Indian route suggestions per origin
const POPULAR_ROUTES: Record<string, { destination: string; label: string; price: string }[]> = {
  DEL: [
    { destination: 'BOM', label: 'Mumbai', price: '₹3,499' },
    { destination: 'BLR', label: 'Bengaluru', price: '₹3,899' },
    { destination: 'HYD', label: 'Hyderabad', price: '₹3,299' },
    { destination: 'DXB', label: 'Dubai', price: '₹14,999' },
  ],
  BOM: [
    { destination: 'DEL', label: 'Delhi', price: '₹3,499' },
    { destination: 'BLR', label: 'Bengaluru', price: '₹2,899' },
    { destination: 'GOI', label: 'Goa', price: '₹2,499' },
    { destination: 'DXB', label: 'Dubai', price: '₹12,999' },
  ],
  BLR: [
    { destination: 'DEL', label: 'Delhi', price: '₹3,899' },
    { destination: 'BOM', label: 'Mumbai', price: '₹2,899' },
    { destination: 'HYD', label: 'Hyderabad', price: '₹2,299' },
    { destination: 'SIN', label: 'Singapore', price: '₹18,499' },
  ],
  HYD: [
    { destination: 'DEL', label: 'Delhi', price: '₹3,299' },
    { destination: 'BOM', label: 'Mumbai', price: '₹2,799' },
    { destination: 'BLR', label: 'Bengaluru', price: '₹2,199' },
    { destination: 'MAA', label: 'Chennai', price: '₹1,999' },
  ],
  MAA: [
    { destination: 'DEL', label: 'Delhi', price: '₹4,199' },
    { destination: 'BOM', label: 'Mumbai', price: '₹3,299' },
    { destination: 'SIN', label: 'Singapore', price: '₹16,499' },
    { destination: 'COK', label: 'Kochi', price: '₹2,099' },
  ],
};

function getRoutesForAirport(iata: string) {
  return POPULAR_ROUTES[iata] || POPULAR_ROUTES['DEL'];
}

export function FlightSearchForm() {
  const router = useRouter();
  const { searchFlights, setSearchQuery } = useFlightStore();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');

  // Nearby & geolocation state
  const [nearestAirport, setNearestAirport] = useState<Airport | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');

  // Realtime Live Radar Detail Drawer States
  const [radarIata, setRadarIata] = useState<string | null>(null);
  const [isRadarOpen, setIsRadarOpen] = useState(false);

  const triggerRadar = (iata: string) => {
    setRadarIata(iata);
    setIsRadarOpen(true);
  };

  // Auto-detect nearest airport on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const results = await airportSearchService.getNearby(latitude, longitude, 1);
          if (results.length > 0) {
            setNearestAirport(results[0]);
            setGeoStatus('done');
          }
        } catch {
          setGeoStatus('denied');
        }
      },
      () => {
        setGeoStatus('denied');
        // Default to DEL as fallback
        airportSearchService.getNearby(28.5562, 77.1, 1).then(r => {
          if (r.length > 0) setNearestAirport(r[0]);
        }).catch(() => {});
      },
      { timeout: 8000 }
    );
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!origin) {
      setFormError('Please select an origin airport.');
      return;
    }
    if (!destination) {
      setFormError('Please select a destination airport.');
      return;
    }
    if (origin === destination) {
      setFormError('Origin and destination must be different airports.');
      return;
    }
    if (!date) {
      setFormError('Please select a departure date.');
      return;
    }

    setSearchQuery({ origin, destination, date });
    await searchFlights(origin, destination, date);
    router.push('/search');
  };

  const handleQuickRouteClick = useCallback((dest: string) => {
    const originIata = nearestAirport?.iata || 'DEL';
    setOrigin(originIata);
    setDestination(dest);
  }, [nearestAirport]);

  const suggestedOriginIata = nearestAirport?.iata || 'DEL';
  const popularRoutes = getRoutesForAirport(suggestedOriginIata);

  return (
    <div className="relative min-h-[85vh] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none"></div>
      <div className="absolute top-10 right-20 w-[200px] h-[200px] rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none"></div>

      {/* Hero Banner Text */}
      <div className="text-center max-w-3xl mb-12 animate-fade-in relative z-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/15 mb-6">
          <Sparkles className="h-3 w-3" />
          <span>Next-Generation Flight Booker</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
          Fly Globally with <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-primary-500 to-indigo-400">Resilient Precision</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          Real-time seat management, live flight tracking, and seamless booking — engineered for the modern traveller.
        </p>
      </div>

      {/* Flight Search Panel Form */}
      <div className="w-full max-w-4xl glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 border-white/5 animate-slide-up">
        <form onSubmit={handleSearch} className="space-y-6">
          
          {/* Integrated Airport Selector */}
          <AirportSelector
            origin={origin}
            destination={destination}
            onOriginChange={(iata) => { setOrigin(iata); setFormError(''); }}
            onDestinationChange={(iata) => { setDestination(iata); setFormError(''); }}
            onViewDetails={triggerRadar}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-2">
            
            {/* Departure Calendar */}
            <div className="md:col-span-2 flex flex-col">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary-400" />
                <span>Departure Date</span>
              </label>
              <input
                type="date"
                required
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="form-input text-sm font-semibold h-[50px]"
              />
            </div>

            {/* Execute Search */}
            <div className="md:col-span-1">
              <button
                type="submit"
                className="w-full h-[50px] flex items-center justify-center space-x-2 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Search className="h-5 w-5" />
                <span>Search Flights</span>
              </button>
            </div>
          </div>

          {/* Form Validation Error */}
          {formError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </form>
      </div>

      {/* Smart Location-Based Flight Recommendations */}
      {(geoStatus === 'done' || geoStatus === 'denied') && (
        <div className="w-full max-w-4xl mt-8 relative z-10 animate-slide-up">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border-white/5">
            <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {geoStatus === 'done' && nearestAirport
                    ? `Popular Routes from ${nearestAirport.city} (${nearestAirport.iata})`
                    : 'Popular Routes from Delhi (DEL)'
                  }
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {geoStatus === 'done' ? 'Based on your location · Click to auto-fill search' : 'Default suggestions · Enable location for personalized routes'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {popularRoutes.map((route) => (
                <button
                  key={route.destination}
                  type="button"
                  onClick={() => handleQuickRouteClick(route.destination)}
                  className="flex flex-col items-start p-3.5 rounded-2xl bg-slate-900/50 hover:bg-primary-500/10 border border-white/5 hover:border-primary-500/30 transition-all duration-200 group text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="h-3.5 w-3.5 text-primary-400 group-hover:text-primary-300 transition" />
                    <span className="text-xs font-bold text-white group-hover:text-primary-300 transition">{route.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400">{suggestedOriginIata} → {route.destination}</span>
                  <span className="text-xs font-bold text-emerald-400 mt-1">{route.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nearest Airports Proximity List widget */}
      <div className="w-full max-w-4xl mt-8 relative z-10 glass-panel rounded-3xl p-6 sm:p-8 border-white/5 animate-slide-up">
        <NearbyAirportsList
          onSelect={(iata) => {
            if (destination === iata) {
              setDestination(origin);
            }
            setOrigin(iata);
          }}
          onViewDetails={triggerRadar}
        />
      </div>

      {/* Real-time Aviation Tracking Widget */}
      <div className="w-full max-w-4xl mt-8 relative z-10 animate-slide-up">
        <FlightProgressTracker />
      </div>

      {/* Trust & Features Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16 relative z-10 px-4">
        <div className="glass-panel rounded-2xl p-5 border-white/5 flex items-start space-x-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">Instant Seat Booking</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Atomic holding triggers ensure your seat selections are locked safely and instantly during checkout.
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border-white/5 flex items-start space-x-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">Offline Fallback Sync</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lose internet? Continue safely. Sensitive fields are filtered, saving draft states locally.
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border-white/5 flex items-start space-x-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">Resilient Operations</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cancel or reschedule easily. Database rules safely protect against double-booking and late cancellations.
            </p>
          </div>
        </div>
      </div>

      {/* Live Transponder/SSE Details Side Drawer */}
      <AirportDetailsPanel
        iata={radarIata}
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
      />

    </div>
  );
}
