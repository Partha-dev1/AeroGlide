import { Airport } from '../types';

const RECENT_SEARCHES_KEY = 'aeroglide_recent_airports';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute search cache TTL

interface CacheEntry {
  timestamp: number;
  results: Airport[];
}

class AirportCacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();

  // 1. Recent selection history
  getRecentSearches(): Airport[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  addRecentSearch(airport: Airport): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getRecentSearches();
      // Remove duplicate entry if exists
      const filtered = current.filter(a => a.iata !== airport.iata);
      // Prepend to top and limit to 5 slots
      const updated = [airport, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save recent airport search in localStorage:', e);
    }
  }

  clearRecentSearches(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  }

  // 2. Query cache lookups
  getCachedResults(query: string): Airport[] | null {
    const key = query.trim().toLowerCase();
    const entry = this.memoryCache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.results;
  }

  setCachedResults(query: string, results: Airport[]): void {
    const key = query.trim().toLowerCase();
    this.memoryCache.set(key, {
      timestamp: Date.now(),
      results
    });
  }
}

export const airportCacheService = new AirportCacheService();
