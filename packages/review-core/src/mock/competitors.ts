import type { CompetitorScore } from '../types.js';

// Phase 1 mock per spec §7.2 — 5 realistic Antalya/Side competitors.
// Designed so RPI vs avg lands near 100 (market-average) for Lago.
// Subcategory keys conform to the consolidated taxonomy in categories.ts.
export const MOCK_COMPETITORS: CompetitorScore[] = [
	{
		venueSlug: 'crystal-sunset-luxury-resort-spa',
		venueName: 'Crystal Sunset Luxury Resort & Spa', // Side, Antalya
		gpi: 79.2,
		reviewCount: 1240,
		categoryScores: [
			{ category: 'FOOD', gpi: 77.1 },
			{ category: 'ROOM', gpi: 81.3 },
			{ category: 'STAFF', gpi: 82.0 },
			{ category: 'POOL', gpi: 76.4 },
			{ category: 'ANIM', gpi: 80.1 },
			{ category: 'FRONT', gpi: 79.5 },
			{ category: 'FACILITY', gpi: 78.2 },
			{ category: 'VALUE', gpi: 73.9 },
			{ category: 'SPA', gpi: 83.0 },
			{ category: 'GENERAL', gpi: 82.5 }
		]
	},
	{
		venueSlug: 'rixos-premium-belek',
		venueName: 'Rixos Premium Belek', // Belek, Antalya
		gpi: 83.1,
		reviewCount: 987,
		categoryScores: [
			{ category: 'FOOD', gpi: 85.2 },
			{ category: 'ROOM', gpi: 82.9 },
			{ category: 'STAFF', gpi: 86.3 },
			{ category: 'POOL', gpi: 79.1 },
			{ category: 'ANIM', gpi: 81.5 },
			{ category: 'FRONT', gpi: 84.0 },
			{ category: 'FACILITY', gpi: 82.7 },
			{ category: 'VALUE', gpi: 78.4 },
			{ category: 'SPA', gpi: 85.5 },
			{ category: 'GENERAL', gpi: 83.9 }
		]
	},
	{
		venueSlug: 'titanic-deluxe-belek',
		venueName: 'Titanic Deluxe Belek', // Belek, Antalya
		gpi: 77.8,
		reviewCount: 654,
		categoryScores: [
			{ category: 'FOOD', gpi: 74.5 },
			{ category: 'ROOM', gpi: 79.2 },
			{ category: 'STAFF', gpi: 80.1 },
			{ category: 'POOL', gpi: 75.3 },
			{ category: 'ANIM', gpi: 76.8 },
			{ category: 'FRONT', gpi: 78.9 },
			{ category: 'FACILITY', gpi: 76.4 },
			{ category: 'VALUE', gpi: 73.1 },
			{ category: 'SPA', gpi: 80.2 },
			{ category: 'GENERAL', gpi: 79.5 }
		]
	},
	{
		venueSlug: 'barut-hemera',
		venueName: 'Barut Hemera', // Side, Antalya
		gpi: 84.6,
		reviewCount: 1102,
		categoryScores: [
			{ category: 'FOOD', gpi: 86.4 },
			{ category: 'ROOM', gpi: 85.1 },
			{ category: 'STAFF', gpi: 88.2 },
			{ category: 'POOL', gpi: 82.7 },
			{ category: 'ANIM', gpi: 80.3 },
			{ category: 'FRONT', gpi: 85.5 },
			{ category: 'FACILITY', gpi: 83.9 },
			{ category: 'VALUE', gpi: 80.1 },
			{ category: 'SPA', gpi: 87.2 },
			{ category: 'GENERAL', gpi: 85.8 }
		]
	},
	{
		venueSlug: 'voyage-sorgun',
		venueName: 'Voyage Sorgun', // Sorgun, Manavgat — same micro-location as Lago
		gpi: 81.7,
		reviewCount: 832,
		categoryScores: [
			{ category: 'FOOD', gpi: 82.5 },
			{ category: 'ROOM', gpi: 83.4 },
			{ category: 'STAFF', gpi: 84.7 },
			{ category: 'POOL', gpi: 80.2 },
			{ category: 'ANIM', gpi: 78.9 },
			{ category: 'FRONT', gpi: 82.1 },
			{ category: 'FACILITY', gpi: 81.3 },
			{ category: 'VALUE', gpi: 77.6 },
			{ category: 'SPA', gpi: 84.1 },
			{ category: 'GENERAL', gpi: 83.0 }
		]
	}
];

// ── Region metadata for "same area" highlighting (LAD-6 / §9.8) ──
// Maps each venueSlug → region.area for the Benchmark page's "Aynı bölge"
// pill. In production this comes from the Venue API; mock-only here.
export const MOCK_COMPETITOR_REGIONS: Record<string, string> = {
	'crystal-sunset-luxury-resort-spa': 'Side',
	'rixos-premium-belek': 'Belek',
	'titanic-deluxe-belek': 'Belek',
	'barut-hemera': 'Side',
	'voyage-sorgun': 'Sorgun'
};
