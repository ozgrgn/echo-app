import type { CategoryScore, HotelScore } from '@talkwo/echo-core';
import { synthDistributionFromAspect } from './review-helpers.js';

// Phase 1 mock per spec §7.1 — updated to v2.7 schema:
//   - 14 categories (added BEACH, ENTERTAINMENT, KIDS, LOCATION)
//   - English subcategory keys (SUBCATEGORY_META in categories.ts)
//   - gpi/rawGpi/positiveCount/negativeCount/neutralCount → aspectScore/headlineScore/mentionCount
//   - avgStarRating added
//   - ANIM → ENTERTAINMENT
//   - SentimentDistribution (5-bucket polarity histogram) attached per category

/**
 * Helper: build a CategoryScore with a synthesized polarity distribution.
 * Keeps the mock declarations terse — distribution stays consistent with
 * aspectScore via the (aspectScore - 50) / 50 = meanPolarity rule.
 *
 * `widthBias` lets a category be tighter or wider than the default stddev
 * (e.g. VALUE has more polarized opinions → 0.5; SPA has narrower → 0.3).
 */
function cat(
  c: Omit<CategoryScore, 'distribution'>,
  widthBias = 0.4
): CategoryScore {
  return {
    ...c,
    distribution: synthDistributionFromAspect(c.mentionCount, c.aspectScore, widthBias)
  };
}

export const MOCK_HOTEL_SCORE: HotelScore = {
  venueSlug: 'aurelia-bay-resort',
  venueName: 'Aurelia Bay Resort & Spa',
  period: '2025-05',
  avgStarRating: 4.3,
  aspectScore: 79.1,
  headlineScore: 81.7,  // 0.70 × ((4.3-1)/4×100) + 0.30 × 79.1 ≈ 81.7
  gpi: 81.7,            // alias for headlineScore
  rpi: 103.2,
  reviewCount: 847,
  responseStats: {
    respondedCount: 322,
    totalCount: 847,
    rate: 0.38,
    medianResponseTimeHours: 18,
    rateTrend: -2.5
  },
  updatedAt: '2025-05-15T03:00:00Z',
  categoryScores: [
    cat({
      category: 'FOOD',
      aspectScore: 76.4,
      headlineScore: 78.3,
      mentionCount: 843,
      reviewCount: 612,
      trend: 1.2,
      topIssues: [
        { subcategory: 'food_variety', count: 43, sampleExcerpt: 'Yemeklerin çeşidi yeterliydi ama lezzet...' },
        { subcategory: 'fb_service',   count: 31, sampleExcerpt: 'Serviste uzun bekleme süreleri vardı...' }
      ],
      topPraises: [
        { subcategory: 'breakfast',  count: 89, sampleExcerpt: 'Kahvaltı çok zengin ve taze ürünler...' }
      ]
    }),
    cat({
      category: 'ROOM',
      aspectScore: 83.1,
      headlineScore: 84.7,
      mentionCount: 1124,
      reviewCount: 701,
      trend: 0.5,
      topIssues: [
        { subcategory: 'room_noise',      count: 28, sampleExcerpt: 'Odadan koridor gürültüsünü duyuyorduk...' },
        { subcategory: 'air_conditioning', count: 19, sampleExcerpt: 'Klima geceleri çok ses çıkardı...' }
      ],
      topPraises: [
        { subcategory: 'room_cleanliness', count: 134, sampleExcerpt: 'Oda tertemizdi, günlük temizlik yapıldı...' },
        { subcategory: 'view_balcony_size', count: 72, sampleExcerpt: 'Deniz manzarası harikaydı...' }
      ]
    }),
    cat({
      category: 'STAFF',
      aspectScore: 86.5,
      headlineScore: 87.2,
      mentionCount: 687,
      reviewCount: 523,
      trend: 2.1,
      topIssues: [
        { subcategory: 'communication_language', count: 22, sampleExcerpt: 'İngilizce konuşabilen az personel vardı...' }
      ],
      topPraises: [
        { subcategory: 'friendliness_helpfulness', count: 165, sampleExcerpt: 'Personel çok ilgili ve güler yüzlüydü...' }
      ]
    }, 0.3),  // tight distribution — staff opinions cluster
    cat({
      category: 'FRONT',
      aspectScore: 82.8,
      headlineScore: 83.9,
      mentionCount: 512,
      reviewCount: 389,
      trend: 1.0,
      topIssues: [
        { subcategory: 'check_in_out', count: 35, sampleExcerpt: 'Check-in için uzun süre bekledik...' }
      ],
      topPraises: [
        { subcategory: 'reception_service', count: 98, sampleExcerpt: 'Karşılama çok sıcak ve hızlıydı...' }
      ]
    }),
    cat({
      category: 'POOL',
      aspectScore: 77.3,
      headlineScore: 79.1,
      mentionCount: 623,
      reviewCount: 445,
      trend: -1.8,
      topIssues: [
        { subcategory: 'sunbed_availability', count: 67, sampleExcerpt: 'Sabah erken kalkıp şezlong tutmak zorundayız...' },
        { subcategory: 'pool_cleanliness',    count: 29, sampleExcerpt: 'Havuz suyu biraz bulanık görünüyordu...' }
      ],
      topPraises: [
        { subcategory: 'pool_size_variety', count: 88, sampleExcerpt: 'Havuzlar büyük ve çok seçenek var...' }
      ]
    }, 0.45),  // wider — pool opinions split (lovers vs sunbed-frustrated)
    cat({
      category: 'BEACH',
      aspectScore: 84.2,
      headlineScore: 85.0,
      mentionCount: 398,
      reviewCount: 312,
      trend: 0.6,
      topIssues: [
        { subcategory: 'beach_cleanliness', count: 18, sampleExcerpt: 'Plajda zaman zaman çöp sorunları...' }
      ],
      topPraises: [
        { subcategory: 'sea_access_quality', count: 107, sampleExcerpt: 'Plaj çok güzel, denize kolay giriş...' }
      ]
    }),
    cat({
      category: 'ENTERTAINMENT',
      aspectScore: 80.9,
      headlineScore: 82.1,
      mentionCount: 389,
      reviewCount: 298,
      trend: 0.3,
      topIssues: [
        { subcategory: 'night_shows', count: 18, sampleExcerpt: 'Gece gösterileri biraz tekrardı...' }
      ],
      topPraises: [
        { subcategory: 'entertainment_staff', count: 71, sampleExcerpt: 'Animasyon ekibi çok enerjik ve eğlenceliydi...' }
      ]
    }),
    cat({
      category: 'KIDS',
      aspectScore: 83.7,
      headlineScore: 84.5,
      mentionCount: 287,
      reviewCount: 224,
      trend: 1.1,
      topIssues: [
        { subcategory: 'kids_pool_area', count: 14, sampleExcerpt: 'Çocuk havuzu biraz küçük...' }
      ],
      topPraises: [
        { subcategory: 'kids_club', count: 54, sampleExcerpt: 'Çocuklarımız mini klüpte çok eğlendi...' }
      ]
    }),
    cat({
      category: 'FACILITY',
      aspectScore: 78.5,
      headlineScore: 80.2,
      mentionCount: 412,
      reviewCount: 298,
      trend: -0.7,
      topIssues: [
        { subcategory: 'wifi_common_area', count: 41, sampleExcerpt: 'Ortak alanlarda Wi-Fi çok yavaştı...' }
      ],
      topPraises: [
        { subcategory: 'common_area_cleanliness', count: 77, sampleExcerpt: 'Ortak alanlar temiz ve bakımlıydı...' }
      ]
    }),
    cat({
      category: 'SPA',
      aspectScore: 85.3,
      headlineScore: 86.1,
      mentionCount: 178,
      reviewCount: 143,
      trend: 1.5,
      topIssues: [
        { subcategory: 'spa_price_reservation', count: 12, sampleExcerpt: 'Masaj ücretleri biraz yüksekti...' }
      ],
      topPraises: [
        { subcategory: 'massage_treatment', count: 63, sampleExcerpt: 'Masaj harikaydı, kesinlikle tavsiye...' }
      ]
    }, 0.3),
    cat({
      category: 'VALUE',
      aspectScore: 72.4,
      headlineScore: 75.8,
      mentionCount: 712,
      reviewCount: 534,
      trend: -2.3,
      topIssues: [
        { subcategory: 'extra_charges',      count: 58, sampleExcerpt: 'Her şey dahil dışında çok ekstra ücret...' },
        { subcategory: 'value_for_money', count: 44, sampleExcerpt: 'Fiyata göre bazı hizmetler yetersiz...' }
      ],
      topPraises: [
        { subcategory: 'concept_inclusion', count: 67, sampleExcerpt: 'HEP kapsamı genişti, memnun kaldık...' }
      ]
    }, 0.5),   // widest — value opinions are most polarized
    cat({
      category: 'GENERAL',
      aspectScore: 84.1,
      headlineScore: 85.0,
      mentionCount: 423,
      reviewCount: 312,
      trend: 0.8,
      topIssues: [],
      topPraises: [
        { subcategory: 'loyalty_revisit', count: 189, sampleExcerpt: 'Kesinlikle tavsiye ederim, tekrar geleceğiz...' }
      ]
    }),
    cat({
      // LOCATION — informationalOnly: true, excluded from GPI (inGpi: false)
      // Distribution still useful for UI even though no GPI contribution.
      category: 'LOCATION',
      aspectScore: null,  // → meanPolarity 0 (neutral-centered)
      headlineScore: 0,
      mentionCount: 156,
      reviewCount: 124,
      trend: 0,
      topIssues: [],
      topPraises: [
        { subcategory: 'proximity_to_town', count: 34, sampleExcerpt: 'Konumu çok merkezi, her şeye yakın...' }
      ]
    })
  ]
};
