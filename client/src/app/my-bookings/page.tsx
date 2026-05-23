'use client';

import { PassengerDashboard } from '../../components/bookings/PassengerDashboard';
import { AuthGuard } from '../../components/auth/AuthGuard';

export default function MyBookings() {
  return (
    <AuthGuard>
      <PassengerDashboard />
    </AuthGuard>
  );
}
