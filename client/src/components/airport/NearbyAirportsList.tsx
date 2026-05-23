import React from 'react';
import { useNearbyAirports } from '../../hooks/useNearbyAirports';
import { AirportBadge } from './AirportBadge';
import { MapPin, Navigation, Info } from 'lucide-react';
import { Airport } from '../../types';

interface NearbyAirportsListProps {
  onSelect?: (iataCode: string) => void;
  onViewDetails?: (iataCode: string) => void;
  limit?: number;
}

export const NearbyAirportsList: React.FC<NearbyAirportsListProps> = ({
  onSelect,
  onViewDetails,
  limit = 4
}) => {
  const { nearbyAirports, loading, error } = useNearbyAirports(limit);

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider animate-pulse">
          <div className="spinner-mini !h-4 !w-4"></div>
          <span>Acquiring Geo-Position Targets...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-16 w-full bg-white/5 border border-white/5 rounded-xl animate-pulse"></div>
          <div className="h-16 w-full bg-white/5 border border-white/5 rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error && nearbyAirports.length === 0) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0" />
        <span>Failed to locate nearby runways. JFK default coordinates loaded instead.</span>
      </div>
    );
  }

  if (nearbyAirports.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary-400" />
          <span>Closest Operational Runways</span>
        </h3>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Based on geographic coordinates
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nearbyAirports.map((airport) => {
          // Compute distance. The server sends sorted items, wait, does the model include distance in nearby?
          // Let's check: the distance is calculated in server's proximity search.
          // Wait, let's verify if the server returns a distance field on the airport or if we should display it if present.
          // In the database search, let's check `server/src/repositories/airportsDatabase.ts`.
          // Even if not directly defined on the typescript interfaces, let's cast or check if `airport.distance` exists.
          const distanceValue = (airport as any).distance;

          return (
            <div 
              key={airport.iata}
              className="group relative flex items-center justify-between p-3.5 bg-slate-900/40 hover:bg-slate-900/70 border border-white/5 hover:border-primary-500/30 rounded-xl transition duration-200"
            >
              <div className="flex gap-2.5">
                <span className="text-2xl leading-none" role="img" aria-label={airport.country}>
                  {airport.flag}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-primary-300 transition duration-150">
                      {airport.city} ({airport.iata})
                    </span>
                    <AirportBadge type={airport.type} />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 max-w-[200px] truncate">
                    {airport.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {distanceValue !== undefined && (
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-sky-400">
                      {distanceValue.toFixed(1)} km
                    </span>
                    <span className="text-[9px] text-slate-500 block uppercase font-semibold">Range</span>
                  </div>
                )}
                
                <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 shrink-0">
                  {onViewDetails && (
                    <button
                      type="button"
                      title="View Radar & Weather"
                      onClick={() => onViewDetails(airport.iata)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 transition duration-150"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onSelect && (
                    <button
                      type="button"
                      onClick={() => onSelect(airport.iata)}
                      className="px-2.5 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500 text-primary-300 hover:text-white text-xs font-bold transition duration-150"
                    >
                      Select
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
