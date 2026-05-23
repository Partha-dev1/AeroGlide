import { StateCreator } from 'zustand';
import { LiveFlightStatus } from '../../types';
import { flightApiService } from '../../services/flightApiService';
import { CombinedState } from '../index';

export interface TrackingState {
  trackedFlightStatus: LiveFlightStatus | null;
  isTracking: boolean;
  trackingError: string | null;

  // Actions
  trackFlight: (flightNumber: string, date?: string) => Promise<void>;
  clearTrackedFlight: () => void;
}

export const createTrackingSlice: StateCreator<
  CombinedState,
  [],
  [],
  TrackingState
> = (set, get) => ({
  trackedFlightStatus: null,
  isTracking: false,
  trackingError: null,

  trackFlight: async (flightNumber, date) => {
    set({ isSearching: true, trackingError: null }); // matches any loader if needed, but we also have isTracking
    set({ isTracking: true });
    try {
      const status = await flightApiService.getFlightStatus(flightNumber, date);
      set({ trackedFlightStatus: status, isTracking: false });
    } catch (err: any) {
      set({ trackingError: err.message || 'Flight tracking lookup failed.', isTracking: false });
    }
  },

  clearTrackedFlight: () => set({ trackedFlightStatus: null, trackingError: null })
});
