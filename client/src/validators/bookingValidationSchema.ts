/**
 * ============================================================
 * BOOKING VALIDATION SCHEMAS — AeroGlide Platform
 * ============================================================
 * Zod schemas for all booking form inputs.
 * Rules:
 *   - Phone: Indian (+91XXXXXXXXXX) or international E.164
 *   - Passport: uppercase alphanumeric, 6–9 chars
 *   - Name: alpha + spaces, 2–50 chars
 *   - Airport: valid IATA code (3 uppercase letters) or full name
 * ============================================================
 */

import { z } from 'zod';

// ─── Phone Number ─────────────────────────────────────────────────────────────
// Accepts:
//   Indian:        +91 followed by exactly 10 digits (starting 6-9)
//   International: + followed by 1–3 digit country code + 7–12 digits
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required.')
  .refine(
    (val) => {
      const stripped = val.trim();
      // Indian number: +91 + 10 digits (first digit 6, 7, 8, or 9)
      const indianRegex = /^\+91[6-9]\d{9}$/;
      // International E.164: + followed by 7–15 digits total
      const internationalRegex = /^\+[1-9]\d{6,14}$/;
      return indianRegex.test(stripped) || internationalRegex.test(stripped);
    },
    {
      message:
        'Enter a valid phone number. Indian: +919876543210 | International: +12025551234',
    }
  )
  .refine(
    (val) => !/[a-zA-Z]/.test(val),
    'Phone number must not contain letters.'
  );

// ─── Passport Number ──────────────────────────────────────────────────────────
// Format: uppercase letters + digits only, 6–9 characters
// E.g. Indian passports: A1234567 (8 chars), some countries 9
export const passportSchema = z
  .string()
  .min(1, 'Passport number is required.')
  .min(6, 'Passport number must be at least 6 characters.')
  .max(9, 'Passport number cannot exceed 9 characters.')
  .refine(
    (val) => /^[A-Z0-9]+$/.test(val),
    'Passport number must contain only uppercase letters and digits (e.g. A1234567).'
  );

// ─── Passenger Name ───────────────────────────────────────────────────────────
export const passengerNameSchema = z
  .string()
  .min(1, 'Name is required.')
  .min(2, 'Name must be at least 2 characters.')
  .max(50, 'Name cannot exceed 50 characters.')
  .refine(
    (val) => /^[a-zA-Z\s]+$/.test(val.trim()),
    'Name may only contain letters and spaces.'
  )
  .transform((val) => val.trim());

// ─── Airport IATA Code ────────────────────────────────────────────────────────
// Valid IATA: exactly 3 uppercase letters (e.g. DEL, BOM, JFK)
export const iataCodeSchema = z
  .string()
  .min(1, 'Airport code is required.')
  .length(3, 'IATA code must be exactly 3 letters (e.g. DEL, BOM).')
  .refine(
    (val) => /^[A-Z]{3}$/.test(val.toUpperCase()),
    'IATA code must contain only letters (e.g. DEL, BOM, JFK).'
  )
  .transform((val) => val.toUpperCase());

// ─── Contact Details Schema ───────────────────────────────────────────────────
export const contactDetailsSchema = z.object({
  email: z
    .string()
    .min(1, 'Contact email is required.')
    .email('Please enter a valid email address.'),
  phone: phoneSchema,
});

// ─── Passenger Schema ─────────────────────────────────────────────────────────
export const passengerSchema = z.object({
  first_name: passengerNameSchema,
  last_name: passengerNameSchema,
  passport_number: passportSchema,
  seat_id: z.string().min(1, 'Seat selection is required.'),
});

// ─── Full Booking Schema ──────────────────────────────────────────────────────
export const bookingSchema = z.object({
  contact: contactDetailsSchema,
  passengers: z
    .array(passengerSchema)
    .min(1, 'At least one passenger is required.'),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────
export type ContactDetailsData = z.infer<typeof contactDetailsSchema>;
export type PassengerData = z.infer<typeof passengerSchema>;
export type BookingData = z.infer<typeof bookingSchema>;

// ─── Legacy Compatibility (non-Zod validation helpers) ───────────────────────
export interface ValidationErrors {
  email?: string;
  phone?: string;
  passengers?: Array<{
    first_name?: string;
    last_name?: string;
    passport_number?: string;
  }>;
}

export function validateContactDetails(
  email: string,
  phone: string
): { isValid: boolean; errors: { email?: string; phone?: string } } {
  const result = contactDetailsSchema.safeParse({ email, phone });
  if (result.success) return { isValid: true, errors: {} };

  const errors: { email?: string; phone?: string } = {};
  const fieldErrors = result.error.flatten().fieldErrors;
  if (fieldErrors.email?.[0]) errors.email = fieldErrors.email[0];
  if (fieldErrors.phone?.[0]) errors.phone = fieldErrors.phone[0];
  return { isValid: false, errors };
}

export function validatePassengers(
  passengers: Array<{ first_name: string; last_name: string; seat_id: string }>,
  passportEntries?: Record<string, string>,
  validatePassport = true
): { isValid: boolean; errors: ValidationErrors['passengers'] } {
  const errors: ValidationErrors['passengers'] = [];
  let hasErrors = false;

  passengers.forEach((p, idx) => {
    const entry = {
      first_name: p.first_name,
      last_name: p.last_name,
      passport_number: passportEntries?.[p.seat_id] ?? 'A0000000',
      seat_id: p.seat_id,
    };

    const schema = validatePassport ? passengerSchema : passengerSchema.omit({ passport_number: true });
    const result = (schema as typeof passengerSchema).safeParse(entry);

    if (!result.success) {
      hasErrors = true;
      const flat = result.error.flatten().fieldErrors;
      const fieldErrors: { first_name?: string; last_name?: string; passport_number?: string } = {
        first_name:      flat.first_name?.[0],
        last_name:       flat.last_name?.[0],
        passport_number: flat.passport_number?.[0],
      };
      errors[idx] = fieldErrors;
    } else {
      errors[idx] = {};
    }
  });

  return { isValid: !hasErrors, errors: hasErrors ? errors : [] };
}
