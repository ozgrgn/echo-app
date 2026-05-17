import type { HotelScore } from '../types.js';

// Minimal stub for Phase 0 compile. Phase 1 brings in the full 10-category
// payload per spec §7.1.
export const MOCK_HOTEL_SCORE: HotelScore = {
  venueSlug: 'lago-hotel-sorgun',
  venueName: 'Lago Hotel Sorgun',
  period: '2025-05',
  gpi: 81.4,
  rpi: 100.1,
  reviewCount: 847,
  updatedAt: '2025-05-15T03:00:00Z',
  categoryScores: []
};
