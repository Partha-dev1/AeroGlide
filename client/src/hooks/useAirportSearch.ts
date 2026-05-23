import { useState, useEffect, useRef, useCallback } from 'react';
import { Airport } from '../types';
import { airportSearchService } from '../services/airportSearchService';
import { airportCacheService } from '../services/airportCacheService';

export function useAirportSearch(initialValue = '', onSelect?: (airport: Airport) => void) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Airport[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedDisplay, setSelectedDisplay] = useState('');

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastIataRef = useRef(initialValue);

  // Keep a mutable ref of the onSelect callback to prevent re-creating selectAirport
  // callback when the parent updates or recreates the callback prop.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Initialize display details and handle initial value updates
  useEffect(() => {
    if (initialValue === lastIataRef.current && selectedDisplay) {
      return;
    }

    if (!initialValue) {
      setSelectedDisplay('');
      setQuery('');
      lastIataRef.current = '';
      return;
    }

    const fetchInitial = async () => {
      try {
        const cached = airportCacheService.getCachedResults(initialValue);
        if (cached && cached.length > 0) {
          const match = cached.find(a => a.iata.toUpperCase() === initialValue.toUpperCase());
          if (match) {
            const display = `${match.city} (${match.iata})`;
            setSelectedDisplay(display);
            setQuery(display);
            lastIataRef.current = initialValue;
            return;
          }
        }
        const results = await airportSearchService.search(initialValue);
        const matched = results.find(a => a.iata.toUpperCase() === initialValue.toUpperCase());
        if (matched) {
          const display = `${matched.city} (${matched.iata})`;
          setSelectedDisplay(display);
          setQuery(display);
          lastIataRef.current = initialValue;
        } else {
          setSelectedDisplay(initialValue);
          setQuery(initialValue);
          lastIataRef.current = initialValue;
        }
      } catch (err) {
        console.error('Error fetching initial airport:', err);
        setSelectedDisplay(initialValue);
        setQuery(initialValue);
        lastIataRef.current = initialValue;
      }
    };

    fetchInitial();
  }, [initialValue]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Debounced search logic
  useEffect(() => {
    if (!isOpen || query.length < 1 || query === selectedDisplay) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Check memory caches first for immediate offline UX
    const cached = airportCacheService.getCachedResults(query);
    if (cached) {
      setSuggestions(cached);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await airportSearchService.search(query);
        // Cap suggestions list
        const capped = results.slice(0, 10);
        setSuggestions(capped);
        airportCacheService.setCachedResults(query, capped);
      } catch (err) {
        console.error('Error fetching autocomplete suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, isOpen, selectedDisplay]);

  // Selection handler (memoized & recursion-safe)
  const selectAirport = useCallback((airport: Airport) => {
    const display = `${airport.city} (${airport.iata})`;
    
    // Track that we already processed this IATA code to prevent redundant fetches
    lastIataRef.current = airport.iata;

    // Guard against redundant/cyclic updates
    setSelectedDisplay(prev => (prev === display ? prev : display));
    setQuery(prev => (prev === display ? prev : display));
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    
    // Add to local historical cache
    airportCacheService.addRecentSearch(airport);
    
    // Notify parent component cleanly
    if (onSelectRef.current) {
      onSelectRef.current(airport);
    }
  }, []);

  // Keyboard accessibility navigator
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % (suggestions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        selectAirport(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [isOpen, suggestions, activeIndex, selectAirport]);

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    setQuery('');
  }, []);

  return {
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
  };
}

