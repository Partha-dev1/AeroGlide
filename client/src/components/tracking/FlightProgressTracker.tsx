import React, { useState, useEffect } from 'react';
import { useAeroStore } from '../../store';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import dynamic from 'next/dynamic';

const FlightTrackingMap = dynamic(
  () => import('./FlightTrackingMap').then((mod) => mod.FlightTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="tracking-map-wrapper flex items-center justify-center text-slate-400 font-semibold bg-slate-900 border border-white/5 rounded-2xl h-[380px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="spinner-ring"></div>
          <span>Locking on to flight telemetry transponder...</span>
        </div>
      </div>
    )
  }
);

interface FlightProgressTrackerProps {
  defaultFlightNumber?: string;
  defaultDate?: string;
}

export const FlightProgressTracker: React.FC<FlightProgressTrackerProps> = ({
  defaultFlightNumber = '',
  defaultDate = ''
}) => {
  const [inputFlight, setInputFlight] = useState(defaultFlightNumber);
  const trackFlight = useAeroStore(state => state.trackFlight);
  const clearTrackedFlight = useAeroStore(state => state.clearTrackedFlight);
  const trackedFlightStatus = useAeroStore(state => state.trackedFlightStatus);
  const isTracking = useAeroStore(state => state.isTracking);
  const trackingError = useAeroStore(state => state.trackingError);

  useEffect(() => {
    if (defaultFlightNumber) {
      trackFlight(defaultFlightNumber, defaultDate || undefined);
    }
    return () => {
      clearTrackedFlight();
    };
  }, [defaultFlightNumber, defaultDate, trackFlight, clearTrackedFlight]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputFlight.trim()) {
      trackFlight(inputFlight.trim().toUpperCase(), defaultDate || undefined);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-air':
        return 'badge-status-inair';
      case 'boarding':
        return 'badge-status-boarding';
      case 'completed':
        return 'badge-status-completed';
      case 'delayed':
        return 'badge-status-delayed';
      default:
        return 'badge-status-scheduled';
    }
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'Scheduled';
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="tracking-wrapper">
      {!defaultFlightNumber && (
        <form onSubmit={handleTrackSubmit} className="tracking-search-form glass-panel">
          <h3 className="tracking-search-title gradient-text-glow">Real-Time Flight Status Tracker</h3>
          <p className="tracking-search-subtitle">Enter any commercial flight number to monitor live coordinates, speed, and gate assignments.</p>
          <div className="tracking-search-row">
            <input
              type="text"
              value={inputFlight}
              onChange={(e) => setInputFlight(e.target.value)}
              placeholder="e.g. AA100, DL45, EK201..."
              className="form-input tracking-search-input"
              required
            />
            <Button
              type="submit"
              isLoading={isTracking}
              className="tracking-search-btn"
            >
              Track Flight
            </Button>
          </div>
          {trackingError && (
            <div className="tracking-search-error animate-shake">
              <span className="error-icon">⚠️</span> {trackingError}
            </div>
          )}
        </form>
      )}

      {isTracking && (
        <Card className="tracking-loading-card">
          <div className="spinner-ring"></div>
          <span>Locking on to flight telemetry...</span>
        </Card>
      )}

      {!isTracking && trackedFlightStatus && (
        <Card className="tracking-card animate-fade-in">
          {/* Header */}
          <div className="tracking-card-header">
            <div>
              <div className="tracking-flight-num-row">
                <span className="tracking-airline-label">{trackedFlightStatus.airline}</span>
                <span className="tracking-flight-code">{trackedFlightStatus.flight_number}</span>
              </div>
              <span className="tracking-live-telemetry-tag">📡 Live Radar Telemetry</span>
            </div>
            <div className={`tracking-status-badge ${getStatusColor(trackedFlightStatus.status)}`}>
              <span className="pulse-indicator"></span>
              {getStatusLabel(trackedFlightStatus.status)}
            </div>
          </div>

          {/* Route Progress Timeline */}
          <div className="tracking-timeline-container">
            {/* Left Airport */}
            <div className="tracking-timeline-hub left">
              <span className="tracking-timeline-iata">{trackedFlightStatus.origin}</span>
              <span className="tracking-timeline-label">ORIGIN</span>
              {trackedFlightStatus.terminal && (
                <span className="tracking-timeline-terminal">Term {trackedFlightStatus.terminal}</span>
              )}
              {trackedFlightStatus.gate && (
                <span className="tracking-timeline-gate">Gate {trackedFlightStatus.gate}</span>
              )}
            </div>

            {/* Flight Line Vector */}
            <div className="tracking-timeline-vector">
              <div className="tracking-vector-line"></div>
              {trackedFlightStatus.status === 'in-air' && (
                <div
                  className="tracking-vector-fill"
                  style={{ '--progress': `${trackedFlightStatus.progress_percent || 0}%` } as React.CSSProperties}
                ></div>
              )}
              <div
                className={`tracking-airplane-anchor ${trackedFlightStatus.status === 'in-air' ? 'in-air-glow' : 'parked'}`}
                style={{
                  '--airplane-left': `${
                    trackedFlightStatus.status === 'completed'
                      ? 100
                      : trackedFlightStatus.status === 'in-air'
                      ? trackedFlightStatus.progress_percent || 0
                      : 0
                  }%`
                } as React.CSSProperties}
              >
                ✈️
              </div>
              {trackedFlightStatus.status === 'in-air' && (
                <span className="tracking-vector-percentage">
                  {trackedFlightStatus.progress_percent || 0}% Complete
                </span>
              )}
            </div>

            {/* Right Airport */}
            <div className="tracking-timeline-hub right">
              <span className="tracking-timeline-iata">{trackedFlightStatus.destination}</span>
              <span className="tracking-timeline-label">DESTINATION</span>
              <span className="tracking-timeline-terminal">Term Main</span>
              <span className="tracking-timeline-gate">Gate ARR</span>
            </div>
          </div>

          {/* Live Radar Map */}
          <div className="my-6">
            <FlightTrackingMap
              origin={trackedFlightStatus.origin}
              destination={trackedFlightStatus.destination}
              latitude={trackedFlightStatus.latitude}
              longitude={trackedFlightStatus.longitude}
              status={trackedFlightStatus.status}
              flightNumber={trackedFlightStatus.flight_number}
              speed={trackedFlightStatus.speed}
              altitude={trackedFlightStatus.altitude}
              progressPercent={trackedFlightStatus.progress_percent}
            />
          </div>

          {/* Flight Metrics Panel */}
          {trackedFlightStatus.status === 'in-air' && (
            <div className="tracking-metrics-grid">
              <div className="tracking-metric-item">
                <span className="metric-icon">🧭</span>
                <div className="metric-details">
                  <span className="metric-value">
                    {trackedFlightStatus.latitude?.toFixed(4)}°, {trackedFlightStatus.longitude?.toFixed(4)}°
                  </span>
                  <span className="metric-label">Coordinates</span>
                </div>
              </div>
              <div className="tracking-metric-item">
                <span className="metric-icon">🏔️</span>
                <div className="metric-details">
                  <span className="metric-value">
                    {trackedFlightStatus.altitude?.toLocaleString()} ft
                  </span>
                  <span className="metric-label">Altitude</span>
                </div>
              </div>
              <div className="tracking-metric-item">
                <span className="metric-icon">⚡</span>
                <div className="metric-details">
                  <span className="metric-value">{trackedFlightStatus.speed} kts</span>
                  <span className="metric-label">Ground Speed</span>
                </div>
              </div>
            </div>
          )}

          {/* Delay Warning Footer */}
          <div className="tracking-card-footer">
            {trackedFlightStatus.delay_minutes && trackedFlightStatus.delay_minutes > 0 ? (
              <div className="tracking-delay-alert font-semibold">
                ⚠️ Delayed by {trackedFlightStatus.delay_minutes} mins due to departure queue flow control.
              </div>
            ) : (
              <div className="tracking-ontime-alert font-semibold">
                ✅ Flight operating normally. On Schedule.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
