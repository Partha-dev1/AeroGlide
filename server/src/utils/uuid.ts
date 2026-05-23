import { v5 as uuidv5 } from 'uuid';

// Use a static DNS namespace UUID for deterministic UUIDv5 generation
const DETERMINISTIC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generates a deterministic UUID based on an input string.
 * This is useful to convert compound keys like "6E100-2026-05-23" safely to a UUID.
 */
export function getDeterministicUuid(str: string): string {
  return uuidv5(str, DETERMINISTIC_NAMESPACE);
}
