import type { Venue } from '../types.js';

// Minimal stub for Phase 0 compile. Phase 1 fills in realistic data.
export const MOCK_VENUES: Venue[] = [
  {
    venueId: '6a08aa75b2f780ab0c068737',
    slug: 'lago-hotel-sorgun',
    name: 'Lago Hotel Sorgun',
    platforms: {
      tripadvisor: { locationId: 545626, url: 'https://www.tripadvisor.com/...' }
    },
    region: {
      area: 'Sorgun',
      district: 'Manavgat',
      province: 'Antalya',
      country_code: 'TR'
    },
    tz: 'Europe/Istanbul',
    isOwned: true,
    source: 'manual',
    status: 'active',
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-05-15T03:00:00Z'
  }
];
