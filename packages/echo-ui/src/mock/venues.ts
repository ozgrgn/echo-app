import type { Venue } from '@talkwo/echo-core';

// Mock venues for Phase 1.
// Includes 2 owned (Lago chain) so the login multi-venue picker is exercised,
// + 1 competitor flagged isOwned:false so competitor scope rules can be tested.
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
	},
	{
		venueId: '6a08aa75b2f780ab0c068738',
		slug: 'lago-hotel-belek',
		name: 'Lago Hotel Belek',
		platforms: {
			tripadvisor: { locationId: 545627, url: 'https://www.tripadvisor.com/...' }
		},
		region: {
			area: 'Belek',
			district: 'Serik',
			province: 'Antalya',
			country_code: 'TR'
		},
		tz: 'Europe/Istanbul',
		isOwned: true,
		source: 'manual',
		status: 'active',
		createdAt: '2025-01-15T08:00:00Z',
		updatedAt: '2025-05-15T03:00:00Z'
	},
	// One competitor so isOwned filtering can be visually verified later.
	{
		venueId: '6a08aa75b2f780ab0c068740',
		slug: 'crystal-sunset-luxury-resort-spa',
		name: 'Crystal Sunset Luxury Resort & Spa',
		platforms: {
			tripadvisor: { locationId: 999001, url: 'https://www.tripadvisor.com/...' }
		},
		region: {
			area: 'Side',
			district: 'Manavgat',
			province: 'Antalya',
			country_code: 'TR'
		},
		tz: 'Europe/Istanbul',
		isOwned: false,
		source: 'auto',
		status: 'active',
		createdAt: '2025-02-01T08:00:00Z',
		updatedAt: '2025-05-15T03:00:00Z'
	}
];
