import type { CompetitorScore } from '@talkwo/echo-core';

// Updated to v2.6 schema: avgStarRating added, categoryScores use headlineScore/aspectScore.
// 5 Antalya/Side all-inclusive competitors — consistent with spec §7.2.

function cs(category: string, headlineScore: number, aspectScore: number | null = null) {
  return { category: category as any, headlineScore, aspectScore };
}

export const MOCK_COMPETITORS: CompetitorScore[] = [
  {
    venueSlug: 'crystal-sunset-luxury-resort-spa',
    venueName: 'Crystal Sunset Luxury Resort & Spa',
    gpi: 79.2,
    avgStarRating: 4.2,
    reviewCount: 1240,
    categoryScores: [
      cs('FOOD', 77.1, 74.8), cs('ROOM', 81.3, 80.1),
      cs('STAFF', 82.0, 81.2), cs('POOL', 76.4, 74.9),
      cs('ENTERTAINMENT', 80.1, 79.3), cs('FRONT', 79.5, 78.8),
      cs('FACILITY', 78.2, 77.0), cs('VALUE', 73.9, 71.5),
      cs('SPA', 83.0, 82.1), cs('GENERAL', 82.5, null),
      cs('BEACH', 81.0, 80.3), cs('KIDS', 79.4, 78.7),
    ]
  },
  {
    venueSlug: 'rixos-premium-belek',
    venueName: 'Rixos Premium Belek',
    gpi: 83.1,
    avgStarRating: 4.5,
    reviewCount: 987,
    categoryScores: [
      cs('FOOD', 85.2, 84.1), cs('ROOM', 82.9, 81.7),
      cs('STAFF', 86.3, 85.9), cs('POOL', 79.1, 77.8),
      cs('ENTERTAINMENT', 81.5, 80.4), cs('FRONT', 84.0, 83.3),
      cs('FACILITY', 82.7, 81.9), cs('VALUE', 78.4, 76.2),
      cs('SPA', 85.5, 84.8), cs('GENERAL', 83.9, null),
      cs('BEACH', 80.2, 79.1), cs('KIDS', 82.1, 81.5),
    ]
  },
  {
    venueSlug: 'titanic-deluxe-belek',
    venueName: 'Titanic Deluxe Belek',
    gpi: 77.8,
    avgStarRating: 4.1,
    reviewCount: 654,
    categoryScores: [
      cs('FOOD', 74.5, 72.1), cs('ROOM', 79.2, 78.0),
      cs('STAFF', 80.1, 79.4), cs('POOL', 75.3, 73.8),
      cs('ENTERTAINMENT', 76.8, 75.9), cs('FRONT', 78.9, 78.1),
      cs('FACILITY', 76.4, 75.2), cs('VALUE', 73.1, 70.9),
      cs('SPA', 80.2, 79.5), cs('GENERAL', 79.5, null),
      cs('BEACH', 77.5, 76.8), cs('KIDS', 76.0, 75.2),
    ]
  },
  {
    venueSlug: 'barut-hemera',
    venueName: 'Barut Hemera',
    gpi: 84.6,
    avgStarRating: 4.6,
    reviewCount: 1102,
    categoryScores: [
      cs('FOOD', 86.4, 85.7), cs('ROOM', 85.1, 84.3),
      cs('STAFF', 88.2, 87.8), cs('POOL', 82.7, 81.5),
      cs('ENTERTAINMENT', 80.3, 79.6), cs('FRONT', 85.5, 84.9),
      cs('FACILITY', 83.9, 83.1), cs('VALUE', 80.1, 78.5),
      cs('SPA', 87.2, 86.6), cs('GENERAL', 85.8, null),
      cs('BEACH', 86.1, 85.4), cs('KIDS', 83.5, 82.8),
    ]
  },
  {
    venueSlug: 'voyage-sorgun',
    venueName: 'Voyage Sorgun',  // same micro-location as Lago
    gpi: 81.7,
    avgStarRating: 4.3,
    reviewCount: 832,
    categoryScores: [
      cs('FOOD', 82.5, 81.3), cs('ROOM', 83.4, 82.6),
      cs('STAFF', 84.7, 84.1), cs('POOL', 80.2, 79.0),
      cs('ENTERTAINMENT', 78.9, 78.1), cs('FRONT', 82.1, 81.4),
      cs('FACILITY', 81.3, 80.5), cs('VALUE', 77.6, 75.9),
      cs('SPA', 84.1, 83.4), cs('GENERAL', 83.0, null),
      cs('BEACH', 82.8, 82.0), cs('KIDS', 80.5, 79.8),
    ]
  }
];
