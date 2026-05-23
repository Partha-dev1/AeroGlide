import React from 'react';
import { AirportAutocomplete } from './AirportAutocomplete';
import { ArrowLeftRight, Activity } from 'lucide-react';

interface AirportSelectorProps {
  origin: string;
  destination: string;
  onOriginChange: (iata: string) => void;
  onDestinationChange: (iata: string) => void;
  onViewDetails?: (iata: string) => void;
}

export const AirportSelector: React.FC<AirportSelectorProps> = ({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onViewDetails
}) => {
  const handleSwap = (e: React.MouseEvent) => {
    e.preventDefault();
    const temp = origin;
    onOriginChange(destination);
    onDestinationChange(temp);
  };

  return (
    <div className="airport-selector-container">
      {/* Origin Selector */}
      <div className="relative flex flex-col w-full">
        <AirportAutocomplete
          id="origin-airport"
          label="Origin Airport"
          value={origin}
          onChange={onOriginChange}
          required
        />
        {origin && onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(origin)}
            className="absolute right-12 top-[34px] flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md px-1.5 py-0.5 transition duration-150 active:scale-95"
            title="Inspect Live Departure Terminal Status"
          >
            <Activity className="h-3 w-3 animate-pulse" />
            <span>Radar</span>
          </button>
        )}
      </div>

      {/* Swap Button */}
      <div className="flex justify-center mt-2 md:mt-6 shrink-0 z-20">
        <button
          type="button"
          onClick={handleSwap}
          className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-900 border border-white/10 hover:border-primary-500/40 text-slate-300 hover:text-white transition duration-200 shadow-md hover:scale-105 active:scale-95"
          title="Swap Origin and Destination"
        >
          <ArrowLeftRight className="h-4.5 w-4.5 rotate-90 md:rotate-0 text-primary-400 hover:text-primary-300 transition duration-150" />
        </button>
      </div>

      {/* Destination Selector */}
      <div className="relative flex flex-col w-full">
        <AirportAutocomplete
          id="destination-airport"
          label="Destination Airport"
          value={destination}
          onChange={onDestinationChange}
          required
        />
        {destination && onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(destination)}
            className="absolute right-12 top-[34px] flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md px-1.5 py-0.5 transition duration-150 active:scale-95"
            title="Inspect Live Arrival Runway Status"
          >
            <Activity className="h-3 w-3 animate-pulse" />
            <span>Radar</span>
          </button>
        )}
      </div>
    </div>
  );
};
