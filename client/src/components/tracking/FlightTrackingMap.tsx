'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { airportSearchService } from '../../services/airportSearchService';

interface FlightTrackingMapProps {
  origin: string;
  destination: string;
  latitude?: number;
  longitude?: number;
  status: string;
  flightNumber: string;
  speed?: number;
  altitude?: number;
  progressPercent?: number;
}

const STATIC_AIRPORT_COORDS: Record<string, [number, number]> = {
  JFK: [40.6397, -73.7789],
  LHR: [51.4700, -0.4543],
  CDG: [49.0097, 2.5479],
  DXB: [25.2532, 55.3657],
  SIN: [1.3644, 103.9915],
  HND: [35.5494, 139.7798],
  LAX: [33.9416, -118.4085],
  SFO: [37.6190, -122.3748],
  SYD: [-33.9461, 151.1772],
  YYZ: [43.6777, -79.6248],
  YVR: [49.1967, -123.1815],
  BKK: [13.6900, 100.7501],
  KUL: [2.7456, 101.7072],
  RUH: [24.9576, 46.6988],
  DOH: [25.2731, 51.6081],
  DEL: [28.5665, 77.1031],
  BOM: [19.0896, 72.8656],
  BLR: [13.1979, 77.7063],
  HYD: [17.2405, 78.4294],
  MAA: [12.9941, 80.1709],
  CCU: [22.6547, 88.4467],
  COK: [10.1520, 76.4019],
  AMD: [23.0772, 72.6347],
  GOI: [15.3808, 73.8314],
  GOX: [15.7292, 73.8681],
  PNQ: [18.5821, 73.9197],
  JAI: [26.8242, 75.8122],
  LKO: [26.7606, 80.8893],
  SXR: [33.9873, 74.7744],
  GAU: [26.1061, 91.5859],
  IXC: [30.6733, 76.7885],
  TRZ: [10.7654, 78.7097],
  STV: [21.1139, 72.7417],
  IXE: [12.9613, 74.8892],
  ATQ: [31.7096, 74.7965],
  BBI: [20.2444, 85.8178],
  TRV: [8.4821, 76.9200],
  CJB: [11.0300, 77.0434],
  IXB: [26.6812, 88.3286],
  VTZ: [17.7252, 83.2243]
};

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function FlightTrackingMap({
  origin,
  destination,
  latitude,
  longitude,
  status,
  flightNumber,
  speed,
  altitude,
  progressPercent = 0
}: FlightTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const [originCoords, setOriginCoords] = useState<[number, number] | null>(
    STATIC_AIRPORT_COORDS[origin.toUpperCase()] || null
  );
  const [destCoords, setDestCoords] = useState<[number, number] | null>(
    STATIC_AIRPORT_COORDS[destination.toUpperCase()] || null
  );

  // Markers and Path layers references
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const planeMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  // Resolve airport coordinates if they are not in the static map
  useEffect(() => {
    const fetchCoords = async () => {
      if (!originCoords && origin) {
        try {
          const results = await airportSearchService.search(origin);
          const match = results.find(
            (a) => a.iata.toUpperCase() === origin.toUpperCase()
          );
          if (match) {
            setOriginCoords([match.latitude, match.longitude]);
          }
        } catch (e) {
          console.error('Failed to query origin airport coords:', e);
        }
      }
      if (!destCoords && destination) {
        try {
          const results = await airportSearchService.search(destination);
          const match = results.find(
            (a) => a.iata.toUpperCase() === destination.toUpperCase()
          );
          if (match) {
            setDestCoords([match.latitude, match.longitude]);
          }
        } catch (e) {
          console.error('Failed to query destination airport coords:', e);
        }
      }
    };
    fetchCoords();
  }, [origin, destination]);

  // Map Setup
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false
    }).setView([20.5937, 78.9629], 4); // Default center of India

    mapRef.current = map;

    // Add CartoDB Dark Matter tile layer
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19
      }
    ).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers, Path and bounds dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers if they need updates
    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (planeMarkerRef.current) {
      planeMarkerRef.current.remove();
      planeMarkerRef.current = null;
    }
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const boundsPoints: L.LatLngExpression[] = [];

    // 1. Plot Origin
    if (originCoords) {
      const originIcon = L.divIcon({
        className: 'map-airport-marker origin',
        html: `<div class="pulse-ring-glow origin"></div><span>${origin}</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      originMarkerRef.current = L.marker(originCoords, { icon: originIcon })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup-title">${origin} Airport</div><div class="map-popup-desc">Departure Origin</div>`
        );
      boundsPoints.push(originCoords);
    }

    // 2. Plot Destination
    if (destCoords) {
      const destIcon = L.divIcon({
        className: 'map-airport-marker destination',
        html: `<div class="pulse-ring-glow"></div><span>${destination}</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      destMarkerRef.current = L.marker(destCoords, { icon: destIcon })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup-title">${destination} Airport</div><div class="map-popup-desc">Arrival Destination</div>`
        );
      boundsPoints.push(destCoords);
    }

    // Determine current plane coordinate
    let planeLat = latitude;
    let planeLon = longitude;

    if (planeLat === undefined || planeLon === undefined) {
      // Fallback interpolation based on status and progress
      if (status === 'completed' && destCoords) {
        [planeLat, planeLon] = destCoords;
      } else if (originCoords) {
        if (destCoords && status === 'in-air') {
          const ratio = progressPercent / 100;
          planeLat = originCoords[0] + (destCoords[0] - originCoords[0]) * ratio;
          planeLon = originCoords[1] + (destCoords[1] - originCoords[1]) * ratio;
        } else {
          [planeLat, planeLon] = originCoords;
        }
      }
    }

    // 3. Plot Route line connecting Origin, Plane and Destination
    if (originCoords && destCoords) {
      const lineCoordinates = [originCoords];
      if (planeLat !== undefined && planeLon !== undefined && status === 'in-air') {
        lineCoordinates.push([planeLat, planeLon]);
      }
      lineCoordinates.push(destCoords);

      routeLineRef.current = L.polyline(lineCoordinates, {
        color: '#0ea5e9',
        weight: 2.5,
        dashArray: '5, 8',
        opacity: 0.65
      }).addTo(map);
    }

    // 4. Plot Plane marker
    if (planeLat !== undefined && planeLon !== undefined) {
      let bearing = 90; // Default facing East
      if (originCoords && destCoords) {
        bearing = calculateBearing(
          originCoords[0],
          originCoords[1],
          destCoords[0],
          destCoords[1]
        );
      }

      // ✈️ emoji points right-up, adjust rotate anchor appropriately (approx 45 degrees offset)
      const adjustedRotation = (bearing - 45 + 360) % 360;

      const planeIcon = L.divIcon({
        className: 'map-plane-marker',
        html: `<div style="transform: rotate(${adjustedRotation}deg); font-size: 28px; line-height: 1;">✈️</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const speedVal = speed !== undefined ? `${speed} kts` : 'N/A';
      const altVal = altitude !== undefined ? `${altitude.toLocaleString()} ft` : 'N/A';

      planeMarkerRef.current = L.marker([planeLat, planeLon], { icon: planeIcon })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup-title">${flightNumber}</div>
           <div class="map-popup-desc">
             <b>Status:</b> ${status.toUpperCase()}<br/>
             <b>Altitude:</b> ${altVal}<br/>
             <b>Speed:</b> ${speedVal}
           </div>`
        );

      if (status === 'in-air') {
        boundsPoints.push([planeLat, planeLon]);
      }
    }

    // Fit map bounds to show full route cleanly
    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 6);
    }
  }, [originCoords, destCoords, latitude, longitude, status, progressPercent, speed, altitude, flightNumber]);

  return (
    <div className="tracking-map-wrapper">
      <div ref={mapContainerRef} className="tracking-map-container" />
    </div>
  );
}
