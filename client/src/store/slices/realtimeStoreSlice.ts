import { StateCreator } from 'zustand';
import { Seat } from '../../types';
import { CombinedState } from '../index';

export interface RealtimeState {
  sseConnected: boolean;
  holdTimeRemaining: number; // seat hold countdown in seconds

  // Actions
  setSseConnected: (connected: boolean) => void;
  setHoldTimeRemaining: (seconds: number) => void;
  decrementHoldTime: () => void;
  updateSeatsFromRealtime: (flightId: string, seats: Seat[]) => void;
}

export const createRealtimeSlice: StateCreator<
  CombinedState,
  [],
  [],
  RealtimeState
> = (set, get) => ({
  sseConnected: false,
  holdTimeRemaining: 0,

  setSseConnected: (connected) => set({ sseConnected: connected }),

  setHoldTimeRemaining: (seconds) => set({ holdTimeRemaining: seconds }),

  decrementHoldTime: () => {
    const { holdTimeRemaining } = get();
    if (holdTimeRemaining > 0) {
      set({ holdTimeRemaining: holdTimeRemaining - 1 });
      
      // Enforce hold lock expiration state rollback if countdown hits zero
      if (get().holdTimeRemaining === 0) {
        console.warn('Seat lock reservation expired! Rolling back selected seats.');
        set({
          selectedSeats: [],
          lockSession: null,
          bookingError: 'Your 10-minute seat lock reservation has expired. Please select seats again.'
        });
      }
    }
  },

  updateSeatsFromRealtime: (flightId, seats) => {
    const { activeFlight } = get();
    if (activeFlight && activeFlight.id === flightId) {
      // Re-map seats, preserving any seats that are optimistically selected by the current client
      const selectedIds = get().selectedSeats.map(s => s.id);
      const updatedSeats = seats.map(s => {
        if (selectedIds.includes(s.id)) {
          // If locked by another session, override optimistic selection
          if (s.status === 'occupied' || (s.status === 'locked' && s.locked_by !== get().lockSession)) {
            console.warn(`Seat ${s.seat_code} was occupied/locked by another traveler. Releasing optimistic selection.`);
            set(state => ({
              selectedSeats: state.selectedSeats.filter(sel => sel.id !== s.id)
            }));
          }
        }
        return s;
      });

      set({ activeFlightSeats: updatedSeats });
    }
  }
});
