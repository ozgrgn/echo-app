/**
 * @talkwo/echo-ui — Frontend-only layer.
 *
 * Contains:
 *   • api.ts     — HTTP client functions (login, fetchTenant, getHotelScore…)
 *   • mock/      — Phase 1 hardcoded data (strangler-fig pattern)
 *   • adapters/  — Raw provider → Review normalizers (tripadvisor etc.)
 *
 * Backend services (absa-service, echo-backend) should import from
 * @talkwo/echo-core only — never from this package.
 */

export * from './api.js';

// Mock helpers — Phase 1 only. Removed as backend endpoints ship.
export * from './mock/review-helpers.js';
export { MOCK_HOTEL_SCORE } from './mock/hotel-score.js';
