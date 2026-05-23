import { StateCreator } from 'zustand';
import { Flight } from '../../types';
import { flightApiService } from '../../services/flightApiService';
import { CombinedState } from '../index';

export interface SearchState {
  searchQuery: {
    origin: string;
    destination: string;
    date: string;
  } | null;
  searchResults: Flight[];
  isSearching: boolean;
  searchError: string | null;

  // Actions
  setSearchQuery: (query: { origin: string; destination: string; date: string } | null) => void;
  searchFlights: (origin: string, destination: string, date: string) => Promise<void>;
}

export const createSearchSlice: StateCreator<
  CombinedState,
  [],
  [],
  SearchState
> = (set, get) => ({
  searchQuery: null,
  searchResults: [],
  isSearching: false,
  searchError: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  searchFlights: async (origin, destination, date) => {
    set({ isSearching: true, searchError: null });
    try {
      const data = await flightApiService.searchFlights(origin, destination, date);
      set({ searchResults: data, isSearching: false });
    } catch (err: any) {
      set({ searchError: err.message || 'Error searching flights.', isSearching: false });
    }
  }
});
