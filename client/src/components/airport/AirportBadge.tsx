import React from 'react';

interface AirportBadgeProps {
  type: 'international' | 'domestic' | 'regional' | 'private' | 'cargo' | 'military' | 'heliport';
}

export const AirportBadge: React.FC<AirportBadgeProps> = ({ type }) => {
  const labelMap: Record<string, string> = {
    international: 'International Hub',
    domestic: 'Domestic Terminal',
    regional: 'Regional Runway',
    private: 'Private Corporate',
    cargo: 'Cargo Logistics',
    military: 'Civil-Military Joint',
    heliport: 'Heli-Taxi Airfield'
  };

  return (
    <span className={`airport-badge airport-badge-${type}`}>
      {labelMap[type] || type}
    </span>
  );
};
