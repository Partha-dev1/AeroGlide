'use client';

import { PassengerDetailsForm } from '../../components/bookings/PassengerDetailsForm';
import { AuthGuard } from '../../components/auth/AuthGuard';

export default function PassengerDetails() {
  return (
    <AuthGuard>
      <PassengerDetailsForm />
    </AuthGuard>
  );
}
