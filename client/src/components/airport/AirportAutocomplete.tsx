import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAirportSearch } from '../../hooks/useAirportSearch';
import { AirportSearchInput } from './AirportSearchInput';
import { airportCacheService } from '../../services/airportCacheService';
import { History, TrendingUp, HelpCircle } from 'lucide-react';
import { Airport } from '../../types';

interface AirportAutocompleteProps {
  id: string;
  label: string;
  value: string; // IATA Code
  onChange: (iataCode: string) => void;
  placeholder?: string;
  required?: boolean;
}

const TRENDING_HUBS: Airport[] = [
  { iata: 'LHR', icao: 'EGLL', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', timezone: 'Europe/London', latitude: 51.47, longitude: -0.45, terminals: ['T2', 'T5'], airlines: [], type: 'international', elevation: 83, flag: '🇬🇧', nearby: [], popularity: 99 },
  { iata: 'SIN', icao: 'WSSS', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore', latitude: 1.36, longitude: 103.99, terminals: ['T1', 'T3'], airlines: [], type: 'international', elevation: 22, flag: '🇸🇬', nearby: [], popularity: 99 },
  { iata: 'JFK', icao: 'KJFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', timezone: 'America/New_York', latitude: 40.63, longitude: -73.77, terminals: ['T4', 'T8'], airlines: [], type: 'international', elevation: 13, flag: '🇺🇸', nearby: [], popularity: 98 },
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai', latitude: 25.25, longitude: 55.36, terminals: ['T1', 'T3'], airlines: [], type: 'international', elevation: 62, flag: '🇦🇪', nearby: [], popularity: 97 },
  { iata: 'HND', icao: 'RJTT', name: 'Haneda International Airport', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo', latitude: 35.54, longitude: 139.77, terminals: ['T1', 'T2'], airlines: [], type: 'international', elevation: 21, flag: '🇯🇵', nearby: [], popularity: 96 }
];

export const AirportAutocomplete: React.FC<AirportAutocompleteProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Search by city, country or code...',
  required = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [recents, setRecents] = useState<Airport[]>([]);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelect = useCallback((airport: Airport) => {
    onChange(airport.iata);
  }, [onChange]);

  const {
    query,
    setQuery,
    suggestions,
    isOpen,
    setIsOpen,
    isLoading,
    activeIndex,
    setActiveIndex,
    selectedDisplay,
    handleKeyDown,
    selectAirport,
    handleFocus
  } = useAirportSearch(value, handleSelect);

  // Load recents on focus
  useEffect(() => {
    if (isOpen) {
      setRecents(airportCacheService.getRecentSearches());
    }
  }, [isOpen]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);

    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  // Click outside detection
  useEffect(() => {
    const clickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideContainer = containerRef.current && containerRef.current.contains(target);
      const clickedInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      
      if (!clickedInsideContainer && !clickedInsideDropdown) {
        setIsOpen(false);
        // Reset query text to current selected details
        if (selectedDisplay) {
          setQuery(selectedDisplay);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [selectedDisplay, setQuery, setIsOpen]);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="relative w-full" ref={containerRef} onKeyDown={handleKeyDown} style={{ position: 'relative' }}>
      <AirportSearchInput
        id={id}
        label={label}
        value={query}
        isLoading={isLoading}
        required={required}
        placeholder={placeholder}
        onFocus={handleFocus}
        onChange={(e) => setQuery(e.target.value)}
      />

      {mounted && isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div 
              ref={dropdownRef}
              className="autocomplete-dropdown glass-panel animate-fade-in"
              style={{
                position: 'absolute',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                right: 'auto',
                zIndex: 99999,
              }}
            >
              {/* Skeleton Loaders */}
              {isLoading && (
                <div className="px-4 py-2">
                  <div className="airport-skeleton skeleton-item"></div>
                  <div className="airport-skeleton skeleton-item"></div>
                  <div className="airport-skeleton skeleton-item"></div>
                </div>
              )}

              {/* Search Result Suggestions */}
              {!isLoading && hasQuery && suggestions.length > 0 && (
                <ul className="autocomplete-virtual-list">
                  {suggestions.map((airport, idx) => (
                    <li
                      key={airport.iata}
                      className={`autocomplete-item ${idx === activeIndex ? 'active' : ''}`}
                      onClick={() => selectAirport(airport)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="autocomplete-item-main">
                        <span className="autocomplete-iata">{airport.iata}</span>
                        <div className="autocomplete-item-details">
                          <div className="autocomplete-city-country">
                            <span className="autocomplete-city">{airport.city}</span>
                            <span className="autocomplete-country">, {airport.country}</span>
                            <span className="autocomplete-flag">{airport.flag}</span>
                          </div>
                          <span className="autocomplete-name">{airport.name}</span>
                        </div>
                      </div>
                      <div className="autocomplete-meta">
                        <span className="autocomplete-icao">{airport.icao}</span>
                        <span className="autocomplete-timezone">GMT {airport.timezone}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Empty Search States */}
              {!isLoading && hasQuery && suggestions.length === 0 && (
                <div className="autocomplete-no-results">
                  <HelpCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <span>No matching runways found globally</span>
                </div>
              )}

              {/* Recently Viewed & Trending Hubs Panel (Displays when query is empty) */}
              {!isLoading && !hasQuery && (
                <div>
                  {/* Recents list */}
                  {recents.length > 0 && (
                    <div className="mb-3">
                      <div className="autocomplete-section-title">
                        <History className="autocomplete-section-icon" />
                        <span>Recent Searches</span>
                      </div>
                      <ul>
                        {recents.map((airport, idx) => (
                          <li
                            key={`recent-${airport.iata}`}
                            className={`autocomplete-item ${idx === activeIndex ? 'active' : ''}`}
                            onClick={() => selectAirport(airport)}
                            onMouseEnter={() => setActiveIndex(idx)}
                          >
                            <div className="autocomplete-item-main">
                              <span className="autocomplete-iata">{airport.iata}</span>
                              <div className="autocomplete-item-details">
                                <div className="autocomplete-city-country">
                                  <span className="autocomplete-city">{airport.city}</span>
                                  <span className="autocomplete-country">, {airport.country}</span>
                                  <span className="autocomplete-flag">{airport.flag}</span>
                                </div>
                                <span className="autocomplete-name">{airport.name}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Trending hub routes */}
                  <div>
                    <div className="autocomplete-section-title">
                      <TrendingUp className="autocomplete-section-icon" />
                      <span>Trending Hubs</span>
                    </div>
                    <ul>
                      {TRENDING_HUBS.map((airport, idx) => (
                        <li
                          key={`trending-${airport.iata}`}
                          className={`autocomplete-item ${idx + recents.length === activeIndex ? 'active' : ''}`}
                          onClick={() => selectAirport(airport)}
                          onMouseEnter={() => setActiveIndex(idx + recents.length)}
                        >
                          <div className="autocomplete-item-main">
                            <span className="autocomplete-iata">{airport.iata}</span>
                            <div className="autocomplete-item-details">
                              <div className="autocomplete-city-country">
                                <span className="autocomplete-city">{airport.city}</span>
                                <span className="autocomplete-country">, {airport.country}</span>
                                <span className="autocomplete-flag">{airport.flag}</span>
                              </div>
                              <span className="autocomplete-name">{airport.name}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
