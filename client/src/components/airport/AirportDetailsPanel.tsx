import React, { useEffect, useState } from 'react';
import { useAirportRealtime } from '../../hooks/useAirportRealtime';
import { airportSearchService } from '../../services/airportSearchService';
import { Airport } from '../../types';
import { AirportBadge } from './AirportBadge';
import { X, Cloud, CloudFog, CloudLightning, Snowflake, Sun, Wind, Clock, Compass, Terminal, Plane, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AirportDetailsPanelProps {
  iata: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AirportDetailsPanel: React.FC<AirportDetailsPanelProps> = ({
  iata,
  isOpen,
  onClose
}) => {
  const [airport, setAirport] = useState<Airport | null>(null);
  const [staticLoading, setStaticLoading] = useState(false);
  const { realtimeUpdate, error: sseError, loading: sseLoading } = useAirportRealtime(iata);

  // Fetch static airport information whenever IATA code changes
  useEffect(() => {
    if (!iata) {
      setAirport(null);
      return;
    }

    const fetchStaticInfo = async () => {
      setStaticLoading(true);
      try {
        const results = await airportSearchService.search(iata);
        const matched = results.find(a => a.iata.toUpperCase() === iata.toUpperCase());
        if (matched) {
          setAirport(matched);
        }
      } catch (err) {
        console.error('Failed to load static airport data in details drawer:', err);
      } finally {
        setStaticLoading(false);
      }
    };

    fetchStaticInfo();
  }, [iata]);

  if (!isOpen) return null;

  // Weather Icon Matcher
  const getWeatherIcon = (weatherType: string) => {
    switch (weatherType) {
      case 'clear':
        return <Sun className="h-6 w-6 text-amber-400 animate-pulse" />;
      case 'fog':
        return <CloudFog className="h-6 w-6 text-slate-400" />;
      case 'storm':
        return <CloudLightning className="h-6 w-6 text-purple-400 animate-bounce" />;
      case 'snow':
        return <Snowflake className="h-6 w-6 text-sky-200 animate-spin-slow" />;
      case 'windy':
        return <Wind className="h-6 w-6 text-teal-400" />;
      default:
        return <Sun className="h-6 w-6 text-amber-400" />;
    }
  };

  // Status Ticker Styling Class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'operational':
        return 'disruption-ticker-operational';
      case 'delayed':
        return 'disruption-ticker-delayed';
      case 'weather-disruption':
      case 'maintenance':
        return 'disruption-ticker-disruption';
      default:
        return 'disruption-ticker-operational';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`details-backdrop ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />

      {/* Slide-out Side Drawer */}
      <div className={`airport-details-drawer ${isOpen ? 'open' : ''}`}>
        
        {/* Header */}
        <div className="drawer-header">
          {airport ? (
            <div className="flex gap-3">
              <span className="text-3xl leading-none" role="img" aria-label={airport.country}>
                {airport.flag}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-extrabold text-white leading-tight">
                    {airport.city} ({airport.iata})
                  </h2>
                  <AirportBadge type={airport.type} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{airport.name}</p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-white">Loading Systems...</h2>
            </div>
          )}
          
          <button 
            onClick={onClose} 
            className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-900/60 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white transition duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="drawer-body">
          {staticLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <div className="spinner-mini !h-8 !w-8"></div>
              <span className="text-xs font-semibold uppercase tracking-wider">Synchronizing Transponder Signals...</span>
            </div>
          ) : airport ? (
            <>
              {/* SSE Live Alert Banner */}
              {realtimeUpdate && (
                <div className={`disruption-ticker ${getStatusClass(realtimeUpdate.status)}`}>
                  {realtimeUpdate.status === 'operational' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block uppercase text-[10px] tracking-wider">
                      System Status: {realtimeUpdate.status.replace('-', ' ')}
                    </span>
                    <span className="text-[11px] font-medium leading-tight block mt-0.5">
                      {realtimeUpdate.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic Simulated Radar Map */}
              <div className="simulated-radar-map">
                <div className="radar-sweep"></div>
                <div className="radar-grid"></div>
                <div className="radar-circle radar-circle-1"></div>
                <div className="radar-circle radar-circle-2"></div>
                <div className="radar-target"></div>
                <div className="radar-target-ping"></div>
                
                {/* Coordinates Label */}
                <div className="radar-coordinates">
                  RDR_LOC: {airport.latitude.toFixed(4)}N / {airport.longitude.toFixed(4)}E | ALT: {airport.elevation}FT
                </div>
              </div>

              {/* Weather & Delay Metrics Grid */}
              {realtimeUpdate && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-panel p-4 border-white/5 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Local Weather</span>
                      {getWeatherIcon(realtimeUpdate.weather)}
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-white capitalize">{realtimeUpdate.weather}</span>
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                        <Wind className="h-3.5 w-3.5" />
                        <span>Wind: {realtimeUpdate.windSpeed} knots</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-4 border-white/5 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Disruptions</span>
                      <Clock className="h-5 w-5 text-sky-400" />
                    </div>
                    <div>
                      <span className={`text-2xl font-extrabold ${realtimeUpdate.delayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {realtimeUpdate.delayMinutes > 0 ? `+${realtimeUpdate.delayMinutes}m` : '0 min'}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-1">Average schedule delay</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Scheduled Runways */}
              {realtimeUpdate && (
                <div className="glass-panel p-4 border-white/5 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Compass className="h-4 w-4 text-emerald-400" />
                    <span>Active Landing Runways</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {realtimeUpdate.activeRunways.map((runway) => (
                      <span 
                        key={runway} 
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/20 text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        {runway}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Terminals & Carriers Information */}
              <div className="grid grid-cols-1 gap-4">
                <div className="glass-panel p-4 border-white/5 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-sky-400" />
                    <span>Available Terminals</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {airport.terminals && airport.terminals.length > 0 ? (
                      airport.terminals.map((terminal) => (
                        <span key={terminal} className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold font-mono">
                          Terminal {terminal}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">Main Commercial Terminal Only</span>
                    )}
                  </div>
                </div>

                <div className="glass-panel p-4 border-white/5 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Plane className="h-4 w-4 text-indigo-400" />
                    <span>Serving Airlines</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {airport.airlines && airport.airlines.length > 0 ? (
                      airport.airlines.map((airline) => (
                        <span key={airline} className="px-2 py-0.5 bg-slate-800/80 border border-white/5 hover:border-slate-600 text-slate-300 rounded font-mono text-xs font-bold transition duration-150">
                          {airline}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">All International Carriers</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Geographic specifications */}
              <div className="text-[11px] text-slate-500 border-t border-white/5 pt-4 flex flex-col gap-1">
                <span>Elevation Reference Point: {airport.elevation} ft</span>
                <span>Timezone Identifier: {airport.timezone}</span>
                {realtimeUpdate && (
                  <span>Last SSE Transponder Sync: {new Date(realtimeUpdate.timestamp).toLocaleTimeString()}</span>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <span>Failed to resolve airport systems details.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
