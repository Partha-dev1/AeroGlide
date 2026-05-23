import React from 'react';
import { Airport } from '../../types';
import { AirportBadge } from './AirportBadge';
import { Globe, Navigation, Info } from 'lucide-react';

interface AirportCardProps {
  airport: Airport;
  onViewDetails?: (iata: string) => void;
  className?: string;
}

export const AirportCard: React.FC<AirportCardProps> = ({
  airport,
  onViewDetails,
  className = ''
}) => {
  return (
    <div className={`airport-card ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <span className="text-3xl leading-none" role="img" aria-label={airport.country}>
            {airport.flag}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white leading-tight">
                {airport.city} ({airport.iata})
              </h3>
              <AirportBadge type={airport.type} />
            </div>
            <span className="text-xs text-slate-400 block mt-0.5">{airport.name}</span>
          </div>
        </div>
        <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/15">
          {airport.icao}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 my-2 text-xs text-slate-300 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-slate-400" />
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Elevation</span>
            <span className="font-medium text-slate-200">{airport.elevation} ft</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Timezone</span>
            <span className="font-medium text-slate-200">{airport.timezone.split('/').pop()?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {airport.airlines && airport.airlines.length > 0 && (
        <div className="text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300 block mb-1">Operating Carriers</span>
          <div className="flex flex-wrap gap-1">
            {airport.airlines.map((carrier) => (
              <span 
                key={carrier} 
                className="bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold"
              >
                {carrier}
              </span>
            ))}
          </div>
        </div>
      )}

      {onViewDetails && (
        <button
          type="button"
          onClick={() => onViewDetails(airport.iata)}
          className="mt-2 w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold bg-primary-500/10 hover:bg-primary-500 border border-primary-500/20 hover:border-transparent text-primary-300 hover:text-white transition duration-200"
        >
          <Info className="h-3.5 w-3.5" />
          <span>Monitor Live Status & Radar</span>
        </button>
      )}
    </div>
  );
};
