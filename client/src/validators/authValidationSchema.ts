/**
 * ============================================================
 * AUTH VALIDATION SCHEMAS — AeroGlide Platform
 * ============================================================
 * Zod schemas for signup and login forms.
 * Rules:
 *   - Email: standard RFC format
 *   - Password: 8+ chars, uppercase, lowercase, digit, special char
 *   - Full Name: alpha + spaces only, 2–50 chars
 * ============================================================
 */

import { z } from 'zod';

// ─── Email ────────────────────────────────────────────────────────────────────
export const emailSchema = z
  .string()
  .min(1, 'Email address is required.')
  .email('Please enter a valid email address (e.g. name@domain.com).')
  .max(254, 'Email address is too long.')
  .refine(
    (val) => /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val),
    'Please enter a valid email address.'
  );

// ─── Password ─────────────────────────────────────────────────────────────────
export const passwordSchema = z
  .string()
  .min(1, 'Password is required.')
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password cannot exceed 128 characters.')
  .refine((val) => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter.')
  .refine((val) => /[a-z]/.test(val), 'Password must contain at least one lowercase letter.')
  .refine((val) => /[0-9]/.test(val), 'Password must contain at least one number.')
  .refine(
    (val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(val),
    'Password must contain at least one special character (e.g. @, #, !, $).'
  );

// ─── Full Name ────────────────────────────────────────────────────────────────
export const fullNameSchema = z
  .string()
  .min(1, 'Full name is required.')
  .min(2, 'Full name must be at least 2 characters.')
  .max(50, 'Full name cannot exceed 50 characters.')
  .refine(
    (val) => /^[a-zA-Z\s]+$/.test(val.trim()),
    'Full name may only contain letters and spaces.'
  )
  .transform((val) => val.trim().replace(/\s+/g, ' '));

// ─── Signup Schema ────────────────────────────────────────────────────────────
export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

// ─── Login Schema ─────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Password Strength Utility ────────────────────────────────────────────────
export interface PasswordStrength {
  score: number;       // 0–5
  label: string;       // Weak / Fair / Good / Strong / Very Strong
  color: string;       // Tailwind colour name
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  const levels: Array<{ label: string; color: string }> = [
    { label: 'Too Weak', color: 'rose' },
    { label: 'Weak', color: 'orange' },
    { label: 'Fair', color: 'amber' },
    { label: 'Good', color: 'lime' },
    { label: 'Strong', color: 'green' },
    { label: 'Very Strong', color: 'emerald' },
  ];

  return { score, ...levels[score], checks };
}
