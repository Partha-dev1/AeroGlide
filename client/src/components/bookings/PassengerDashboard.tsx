'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore, useFlightStore } from '../../store';
import { 
  Ticket, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Armchair, 
  XCircle, 
  RefreshCw as SwapIcon, 
  WifiOff, 
  CheckCircle2, 
  ShieldAlert, 
  Download,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { formatCurrency, formatDateFriendly, formatDateTime } from '../../utils';
import { APP_CONFIG } from '../../config/appConfig';
import { flightApiService } from '../../services/flightApiService';

// Real-time Countdown Sub-component
function DepartureCountdown({ departureTime, status }: { departureTime: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isBoarding, setIsBoarding] = useState<boolean>(false);

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(departureTime).getTime() - Date.now();
      
      if (difference <= 0) {
        setTimeLeft(status === 'completed' ? 'Arrived / Completed' : 'Departed');
        setIsBoarding(false);
        return;
      }

      const totalSeconds = Math.floor(difference / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const days = Math.floor(totalHours / 24);

      const hours = totalHours % 24;
      const minutes = totalMinutes % 60;
      const seconds = totalSeconds % 60;

      // Boarding active if departure is within 2 hours
      setIsBoarding(totalHours < 2 && status !== 'cancelled' && status !== 'completed');

      let timeString = '';
      if (days > 0) timeString += `${days}d `;
      timeString += `${hours}h ${minutes}m ${seconds}s`;
      setTimeLeft(timeString);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [departureTime, status]);

  if (status === 'cancelled' || status === 'completed') return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <div className="px-3 py-1 rounded-lg bg-slate-900/80 border border-white/5 flex items-center space-x-1.5">
        <Clock className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Departs in:</span>
        <span className="text-xs font-mono font-bold text-primary-400">{timeLeft}</span>
      </div>
      {isBoarding && (
        <span className="px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest animate-pulse flex items-center space-x-1 bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span>
          <span>📢 BOARDING ACTIVE</span>
        </span>
      )}
    </div>
  );
}

function MyBookingsContent() {
  const searchParams = useSearchParams();
  const { 
    userId, 
    authToken,
    myBookings, 
    fetchUserBookings, 
    lookupBookingAndCache,
    cancelBooking,
    rescheduleBooking,
    isLoadingBookings,
    bookingsError,
    bookingActionError,
    clearBookingActionError
  } = useUserStore();

  const { 
    offlineDrafts, 
    syncOfflineDrafts, 
    syncStatus, 
    syncErrorMessage,
    removeOfflineDraft
  } = useFlightStore();

  // Lookup guest state
  const [lookupRef, setLookupRef] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [guestBooking, setGuestBooking] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [reenteredPassports, setReenteredPassports] = useState<Record<string, string>>({});

  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [reschedulingBooking, setReschedulingBooking] = useState<any>(null);
  const [availableFlights, setAvailableFlights] = useState<any[]>([]);
  const [selectedNewFlight, setSelectedNewFlight] = useState<any>(null);
  const [newSeats, setNewSeats] = useState<any[]>([]);
  const [selectedNewSeatId, setSelectedNewSeatId] = useState('');
  const [isProcessingReschedule, setIsProcessingReschedule] = useState(false);

  // Custom Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<any>(null);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  useEffect(() => {
    if (userId && authToken) {
      fetchUserBookings();
    }
    // Auto-open sync modal if sync=true query param
    if (searchParams.get('sync') === 'true' && offlineDrafts.length > 0) {
      setShowSyncModal(true);
    }
  }, [userId, authToken, searchParams]);

  // Guest booking lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setGuestBooking(null);

    if (!lookupRef || !lookupEmail) return;

    setLookupLoading(true);
    const result = await lookupBookingAndCache(lookupRef, lookupEmail);
    setLookupLoading(false);

    if (result) {
      setGuestBooking(result);
    } else {
      setLookupError('No booking found with this reference and contact email.');
    }
  };

  // Perform Cancellation
  const executeCancel = async () => {
    if (!cancellingBooking) return;
    clearBookingActionError();
    setIsProcessingCancel(true);
    const success = await cancelBooking(cancellingBooking.id);
    setIsProcessingCancel(false);

    if (success) {
      setShowCancelModal(false);
      if (guestBooking?.id === cancellingBooking.id) {
        // Refresh guest details lookup
        const result = await lookupBookingAndCache(guestBooking.booking_reference, guestBooking.contact_email);
        setGuestBooking(result);
      }
      if (userId) {
        fetchUserBookings();
      }
    }
    // On failure, bookingActionError is set in the store — displayed inside the modal
  };

  // Sync Trigger
  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncOfflineDrafts(reenteredPassports);
    if (success) {
      setShowSyncModal(false);
      setReenteredPassports({});
      if (userId) fetchUserBookings();
    }
  };

  // Load Reschedule Modal
  const handleOpenReschedule = async (booking: any) => {
    setReschedulingBooking(booking);
    setSelectedNewFlight(null);
    setNewSeats([]);
    setSelectedNewSeatId('');
    
    // Fetch available reschedule flight candidates
    try {
      const flights = await flightApiService.searchFlights('', '', '');
      // Exclude current flight
      setAvailableFlights(flights.filter((f: any) => f.id !== booking.flight_id));
    } catch (e) {
      console.error(e);
    }
    setShowRescheduleModal(true);
  };

  // Load seats when a new flight is selected for reschedule
  const handleRescheduleFlightChange = async (flightId: string) => {
    const flight = availableFlights.find(f => f.id === flightId);
    setSelectedNewFlight(flight);
    setSelectedNewSeatId('');

    try {
      const seats = await flightApiService.getFlightSeats(flightId);
      // Only available seats
      setNewSeats(seats.filter((s: any) => s.status === 'available'));
    } catch (e) {
      console.error(e);
    }
  };

  const executeReschedule = async () => {
    if (!reschedulingBooking || !selectedNewFlight || !selectedNewSeatId) return;

    clearBookingActionError();
    setIsProcessingReschedule(true);
    // Temporary lock session for the new seat
    const lockSession = 'reschedule-session-uuid-token';
    const seat = newSeats.find(s => s.id === selectedNewSeatId);
    
    if (!seat) {
      setIsProcessingReschedule(false);
      return;
    }

    // Attempt lock and reschedule
    const success = await rescheduleBooking(
      reschedulingBooking.id,
      selectedNewFlight.id,
      [seat.id],
      lockSession
    );

    setIsProcessingReschedule(false);
    if (success) {
      setShowRescheduleModal(false);
      if (guestBooking?.id === reschedulingBooking.id) {
        // Refresh guest details lookup
        const result = await lookupBookingAndCache(guestBooking.booking_reference, guestBooking.contact_email);
        setGuestBooking(result);
      }
      if (userId) {
        fetchUserBookings();
      }
    }
    // On failure, bookingActionError is set in the store — displayed inside the modal
  };

  // Plain receipt downloader helper
  const downloadTicket = (booking: any) => {
    const text = `==================================================
FLIGHT MANAGEMENT PLATFORM - OFFICIAL RECEIPT
==================================================
BOOKING REFERENCE: ${booking.booking_reference}
BOOKING STATUS:    ${booking.status.toUpperCase()}
DATE OF PURCHASE:  ${new Date(booking.created_at).toLocaleString()}
--------------------------------------------------
FLIGHT INFORMATION:
Flight Number:     ${booking.flight?.flight_number}
Carrier:           ${booking.flight?.airline}
Route:             ${booking.flight?.origin} -> ${booking.flight?.destination}
Departure Time:    ${new Date(booking.flight?.departure_time).toLocaleString()}
Arrival Time:      ${new Date(booking.flight?.arrival_time).toLocaleString()}
Aircraft Type:     ${booking.flight?.aircraft_type || 'N/A'}
Terminal / Gate:   T${booking.flight?.terminal || '1'} / Gate ${booking.flight?.gate || 'ARR'}
--------------------------------------------------
PASSENGER & SEAT ASSIGNMENTS:
${booking.passengers?.map((p: any, idx: number) => `${idx + 1}. Name: ${p.first_name} ${p.last_name}
   Seat: ${p.seat?.seat_code} (${p.seat?.class?.toUpperCase()} Class)
   Passport: ${p.passport_number || 'Confidential'}`).join('\n')}
--------------------------------------------------
FINANCIAL SUMMARY:
Base Fare:         ${formatCurrency(Number(booking.flight?.base_price || 0))}
Total Paid:        ${formatCurrency(Number(booking.total_price))}
--------------------------------------------------
Thank you for choosing our airline network.
Please arrive at the airport at least 3 hours 
before international and 2 hours before domestic 
departures. This receipt must be presented 
during baggage check-in and security.
==================================================`;
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `receipt-${booking.booking_reference}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderBookingCard = (booking: any) => {
    const isCancelled = booking.status === 'cancelled';
    const isRescheduled = booking.status === 'rescheduled';

    return (
      <div 
        key={booking.id} 
        className={`glass-panel rounded-3xl p-6 border-white/5 space-y-4 relative overflow-hidden transition-all duration-300 ${
          isCancelled ? 'opacity-65 border-red-500/10' : ''
        }`}
      >
        {/* Status Stripe Badge */}
        <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-extrabold uppercase tracking-widest ${
          isCancelled ? 'bg-red-500/20 text-red-400' :
          isRescheduled ? 'bg-primary-500/20 text-primary-400' :
          'bg-emerald-500/20 text-emerald-400'
        }`}>
          {booking.status}
        </div>

        {/* Card Header (PNR & Airline) */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-center text-primary-500">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Booking Reference</p>
              <p className="text-lg font-black tracking-widest text-white">{booking.booking_reference}</p>
            </div>
          </div>
          <button
            onClick={() => downloadTicket(booking)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-slate-900 text-slate-300 hover:text-white transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Receipt</span>
          </button>
        </div>

        {/* Flight route timing details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <p className="text-xs font-semibold text-slate-500">Departure</p>
            <p className="text-base font-extrabold text-white mt-0.5">{new Date(booking.flight?.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-xs text-slate-400">{formatDateFriendly(booking.flight?.departure_time)}</p>
            <p className="text-[10px] font-bold text-slate-500">{booking.flight?.origin} Airport</p>
          </div>
          <div className="flex flex-col items-center">
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-white/5 text-[9px] font-mono text-slate-400 mb-1">
              {booking.flight?.flight_number}
            </span>
            <div className="h-0.5 w-16 bg-slate-800 rounded relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary-500"></div>
            </div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mt-1">
              {booking.flight?.airline}
            </span>
          </div>
          <div className="md:text-right">
            <p className="text-xs font-semibold text-slate-500">Arrival</p>
            <p className="text-base font-extrabold text-white mt-0.5">{new Date(booking.flight?.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-xs text-slate-400">{formatDateFriendly(booking.flight?.arrival_time)}</p>
            <p className="text-[10px] font-bold text-slate-500">{booking.flight?.destination} Airport</p>
          </div>
        </div>

        {/* Departure Live countdown timer */}
        {booking.flight?.departure_time && (
          <DepartureCountdown 
            departureTime={booking.flight.departure_time} 
            status={booking.status} 
          />
        )}

        {/* Passengers assignments list */}
        <div className="border-t border-white/5 pt-4 space-y-2">
          {booking.passengers?.map((p: any, idx: number) => (
            <div key={p.id || idx} className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300">{p.first_name} {p.last_name}</span>
              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-slate-900 border border-white/5 font-bold text-primary-400 uppercase tracking-widest text-[10px]">
                <Armchair className="h-3 w-3" />
                <span>{p.seat?.seat_code} ({p.seat?.class})</span>
              </span>
            </div>
          ))}
        </div>

        {/* Pricing & Control buttons */}
        {!isCancelled && (
          <div className="border-t border-white/5 pt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Total Charged</span>
              <span className="text-base font-black text-white">{formatCurrency(Number(booking.total_price))}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleOpenReschedule(booking)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/5 hover:border-primary-500/30 text-slate-300 hover:text-primary-400 transition"
              >
                <SwapIcon className="h-3.5 w-3.5" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={() => {
                  setCancellingBooking(booking);
                  setShowCancelModal(true);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:border-red-500 text-red-400 hover:text-white transition"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancel Booking</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Compute status metrics counts
  const confirmedCount = myBookings.filter((b: any) => b.status === 'confirmed').length;
  const rescheduledCount = myBookings.filter((b: any) => b.status === 'rescheduled').length;
  const cancelledCount = myBookings.filter((b: any) => b.status === 'cancelled').length;

  return (
    <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Page Title */}
      <div className="border-b border-white/5 pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Passenger Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Manage active flights, reschedule tickets, and reconcile offline state.</p>
        </div>

        {/* sync alert trigger */}
        {offlineDrafts.length > 0 && (
          <button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition animate-pulse-subtle"
          >
            <WifiOff className="h-4 w-4" />
            <span>Sync {offlineDrafts.length} Offline Drafts</span>
          </button>
        )}
      </div>

      {/* Modern Status Counters Grid */}
      {userId && myBookings.length > 0 && (
        <div className="grid grid-cols-3 gap-4 pl-1">
          <div className="glass-panel p-4 rounded-2xl border-white/5 flex flex-col justify-center items-center text-center hover:border-emerald-500/25 transition">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Confirmed</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1">{confirmedCount}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl border-white/5 flex flex-col justify-center items-center text-center hover:border-primary-500/25 transition">
            <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest">Rescheduled</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1">{rescheduledCount}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl border-white/5 flex flex-col justify-center items-center text-center hover:border-red-500/25 transition">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Cancelled</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1">{cancelledCount}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Main Dashboard Panel (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {userId ? (
            // LOGGED IN USER VIEW
            <div className="space-y-6">
              <div className="flex items-center justify-between pl-1">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                  Your Booking Transactions
                </h3>
                <button 
                  onClick={fetchUserBookings}
                  className="text-xs font-bold text-primary-400 hover:text-primary-300 flex items-center space-x-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingBookings ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="h-8 w-8 border-3 border-t-primary-500 border-white/10 rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-500">Querying transactions list...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookingsError && (
                    <div className="glass-panel rounded-2xl p-4 border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 flex items-start space-x-2.5 mb-2 animate-fade-in">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-550" />
                      <div>
                        <p className="font-extrabold uppercase tracking-wide">Offline / Database Connection Loss</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Failed to load live booking transactions ({bookingsError}). Showing offline cached data from local storage.
                        </p>
                      </div>
                    </div>
                  )}

                  {myBookings.length === 0 ? (
                    <div className="glass-panel rounded-3xl p-12 text-center border-white/5 flex flex-col items-center">
                      <Ticket className="h-10 w-10 text-slate-600 mb-3" />
                      <p className="text-sm font-bold text-white">No Bookings Found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                        You don't have any confirmed ticket records yet. Try searching flights and booking tickets.
                      </p>
                    </div>
                  ) : (
                    myBookings.map(renderBookingCard)
                  )}
                </div>
              )}
            </div>
          ) : (
            // NOT LOGGED IN DEFAULT INFO
            <div className="glass-panel rounded-3xl p-8 border-white/5 flex flex-col items-center text-center space-y-4">
              <ShieldAlert className="h-12 w-12 text-primary-500/60" />
              <div>
                <h3 className="text-base font-bold text-white">Dashboard Session Required</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
                  Log in as a mock passenger using the navbar button to query transaction history lists and manage your booking orders.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* PNR Guest Lookup Panel (Right Column) */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="glass-panel rounded-3xl p-6 border-white/5 shadow-xl space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Guest PNR Lookup
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Lookup ticket receipt using reference and email.</p>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">PNR Reference Code</label>
                <input 
                  type="text" 
                  required
                  maxLength={6}
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value)}
                  placeholder="E.g. A1B2C3"
                  className="form-input text-xs h-10 uppercase font-mono tracking-widest"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Contact Email</label>
                <input 
                  type="email" 
                  required
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="form-input text-xs h-10"
                />
              </div>

              {lookupError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 flex items-start space-x-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full py-2.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg text-xs flex items-center justify-center space-x-2 transition"
              >
                {lookupLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                     <Search className="h-3.5 w-3.5" />
                     <span>Search Booking</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Guest Booking Details Card Display */}
          {guestBooking && (
            <div className="animate-slide-up">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Guest Booking Record</h4>
              {renderBookingCard(guestBooking)}
            </div>
          )}

        </div>

      </div>

      {/* 1. SYNC MODAL PANEL */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 border-amber-500/20 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2.5">
                <WifiOff className="h-5 w-5 text-amber-400 animate-pulse" />
                <span>Re-enter Passports to Sync</span>
              </h3>
              <button 
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-white text-2xl font-light"
              >
                &times;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-400 mb-6 leading-relaxed">
              🔒 Passport numbers are never stored in localStorage to protect traveler privacy. Please re-enter them below to finalize booking reconciliation.
            </div>

            <form onSubmit={handleSyncSubmit} className="space-y-6">
              {offlineDrafts.map((draft, dIdx) => (
                <div key={draft.temp_ref} className="p-4 rounded-2xl bg-slate-900 border border-white/5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-[10px] font-bold text-primary-400">Route: {draft.route}</span>
                    <button 
                      type="button"
                      onClick={() => removeOfflineDraft(draft.temp_ref)}
                      className="text-[9px] font-bold text-red-400 hover:underline"
                    >
                      Delete Draft
                    </button>
                  </div>
                  
                  {draft.passengers.map((p, pIdx) => (
                    <div key={p.seat_id} className="space-y-2">
                      <p className="text-[11px] font-bold text-white">
                        {pIdx + 1}. {p.first_name} {p.last_name} (Seat {draft.passengers[pIdx].seat_id.substring(0,3)})
                      </p>
                      <input 
                        type="text" 
                        required
                        value={reenteredPassports[p.seat_id] || ''}
                        onChange={(e) => setReenteredPassports({
                          ...reenteredPassports,
                          [p.seat_id]: e.target.value
                        })}
                        placeholder="Passport Number (E.g. A12345678)"
                        className="form-input text-xs h-9 border-primary-500/20"
                      />
                    </div>
                  ))}
                </div>
              ))}

              {syncStatus === 'error' && syncErrorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start space-x-1.5 animate-shake">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{syncErrorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={syncStatus === 'syncing'}
                className="w-full py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg text-sm flex items-center justify-center space-x-2 transition"
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Syncing & Booking Seats...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Finalize Ticket Synchronization</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. RESCHEDULE MODAL PANEL */}
      {showRescheduleModal && reschedulingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 border-white/5 animate-slide-up max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <SwapIcon className="h-4.5 w-4.5 text-primary-400" />
                <span>Reschedule Booking Wizard</span>
              </h3>
              <button 
                onClick={() => setShowRescheduleModal(false)}
                className="text-slate-400 hover:text-white text-2xl font-light"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Select New Flight</label>
                <select
                  onChange={(e) => handleRescheduleFlightChange(e.target.value)}
                  className="form-input text-xs h-10 appearance-none bg-slate-900 border border-white/10 rounded-xl px-3 w-full"
                >
                  <option value="">-- Choose New Flight Schedule --</option>
                  {availableFlights.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.flight_number} ({f.origin}➔{f.destination}) - Base ₹{f.base_price}
                    </option>
                  ))}
                </select>
              </div>

              {selectedNewFlight && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 space-y-4">
                  <div className="text-xs space-y-1">
                    <p className="text-slate-400">Departure: <span className="text-white font-semibold">{new Date(selectedNewFlight.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {formatDateFriendly(selectedNewFlight.departure_time)}</span></p>
                    <p className="text-slate-400">Arrival: <span className="text-white font-semibold">{new Date(selectedNewFlight.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {formatDateFriendly(selectedNewFlight.arrival_time)}</span></p>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Select New Seat</label>
                    <select
                      value={selectedNewSeatId}
                      onChange={(e) => setSelectedNewSeatId(e.target.value)}
                      className="form-input text-xs h-10 appearance-none bg-slate-900 border border-white/10 rounded-xl px-3 w-full"
                    >
                      <option value="">-- Choose Available Cabin Seat --</option>
                      {newSeats.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.seat_code} — {s.class} class (x{s.price_multiplier} multiplier)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rescheduling flat fee warning */}
                  <div className="p-3 rounded-xl bg-primary-500/5 border border-primary-500/10 text-[10px] text-primary-300 leading-relaxed">
                    ⚙️ Rescheduling is subject to a flat change fee of <strong>{formatCurrency(1500)}</strong> + seat multipliers upgrades if applicable.
                  </div>
                </div>
              )}

              <button
                onClick={executeReschedule}
                disabled={isProcessingReschedule || !selectedNewSeatId}
                className="w-full mt-4 py-2.5 rounded-xl font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg text-xs flex items-center justify-center space-x-2 transition"
              >
                {isProcessingReschedule ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Confirm Schedule Change</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. CUSTOM CANCELLATION MODAL OVERLAY */}
      {showCancelModal && cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl glass-panel p-6 sm:p-8 border-red-500/20 text-center animate-slide-up space-y-5">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-white">Confirm Ticket Cancellation</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Are you absolutely sure you want to cancel booking reference <strong>{cancellingBooking.booking_reference}</strong>?
                This action is irreversible and will release all seat locks.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
              >
                Keep Ticket
              </button>
              <button
                onClick={executeCancel}
                disabled={isProcessingCancel}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition flex items-center justify-center space-x-1.5"
              >
                {isProcessingCancel ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span>Confirm Cancel</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export function PassengerDashboard() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="h-10 w-10 border-4 border-t-primary-500 border-white/10 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-semibold">Loading dashboard assets...</p>
      </div>
    }>
      <MyBookingsContent />
    </Suspense>
  );
}
