/**
 * Client Application Configuration
 */

export const APP_CONFIG = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  OFFLINE_DRAFT_PREFIX: 'OFFLINE-',
  MOCK_USER_ID: 'mock-user-12345-uuid-token',
};
