import type { HotelScore } from '../types.js';

// Full Phase 1 mock per spec §7.1, updated 2026-05-18 to use the
// consolidated subcategory taxonomy (see categories.ts).
//
// Numbers preserved from earlier draft so dashboard renders the same
// GPI/RPI/counts; only subcategory key strings remapped.
//
// Remap applied:
//   kahvalti / aksam_yemegi    → tat_cesit
//   ses_izolasyon / koku / wifi (in ROOM) / klima → teknik_oda
//   manzara                    → konfor (best fit)
//   sezlong_yer                → sezlong_alan
//   havuz_temizlik             → havuz
//   deniz_giris / plaj_temizlik → plaj_deniz
//   ilgi_gurbet / guler_yuz    → tutum
//   dil_yetkinlik              → iletisim
//   gece_show                  → gece_gosteri
//   cocuk_mini_club            → cocuk
//   bekleme_suresi / check_in  → check_in_out
//   wifi (in FACILITY)         → teknik_genel
//   genel_temizlik             → genel_gorunum
//   fiyat_kalite               → para_karsiligi
//   her_sey_dahil_kapsam       → para_karsiligi
//   masaj_kalite / fiyat (SPA) → spa_wellness
//   tavsiye                    → genel
export const MOCK_HOTEL_SCORE: HotelScore = {
  venueSlug: 'lago-hotel-sorgun',
  venueName: 'Lago Hotel Sorgun',
  period: '2025-05',
  gpi: 81.4,
  rpi: 100.1,
  reviewCount: 847,
  updatedAt: '2025-05-15T03:00:00Z',
  categoryScores: [
    {
      category: 'FOOD',
      gpi: 78.3, rawGpi: 76.1, reviewCount: 612,
      positiveCount: 380, negativeCount: 185, neutralCount: 47,
      trend: 1.2,
      topIssues: [
        { subcategory: 'tat_cesit',   count: 43, sampleExcerpt: 'Yemeklerin çeşidi yeterliydi ama...' },
        { subcategory: 'servis_hiz',  count: 31, sampleExcerpt: 'Serviste uzun bekleme süreleri...' }
      ],
      topPraises: [
        { subcategory: 'tat_cesit',   count: 89, sampleExcerpt: 'Kahvaltı çok zengin ve taze...' }
      ]
    },
    {
      category: 'ROOM',
      gpi: 84.7, rawGpi: 83.9, reviewCount: 701,
      positiveCount: 489, negativeCount: 142, neutralCount: 70,
      trend: 0.5,
      topIssues: [
        { subcategory: 'teknik_oda',  count: 28, sampleExcerpt: 'Odadan koridoru duyuyorduk...' },
        { subcategory: 'konfor',      count: 19, sampleExcerpt: 'Odada hafif nem kokusu vardı...' }
      ],
      topPraises: [
        { subcategory: 'temizlik',    count: 134, sampleExcerpt: 'Oda tertemizdi, günlük temizlik...' },
        { subcategory: 'konfor',      count: 72,  sampleExcerpt: 'Deniz manzarası harikaydı...' }
      ]
    },
    {
      category: 'STAFF',
      gpi: 87.2, rawGpi: 86.8, reviewCount: 523,
      positiveCount: 387, negativeCount: 78, neutralCount: 58,
      trend: 2.1,
      topIssues: [
        { subcategory: 'iletisim',    count: 22, sampleExcerpt: 'İngilizce konuşan az personel...' }
      ],
      topPraises: [
        { subcategory: 'tutum',       count: 165, sampleExcerpt: 'Personel çok ilgili ve güler yüzlüydü...' }
      ]
    },
    {
      category: 'POOL',
      gpi: 79.1, rawGpi: 77.3, reviewCount: 445,
      positiveCount: 267, negativeCount: 134, neutralCount: 44,
      trend: -1.8,
      topIssues: [
        { subcategory: 'sezlong_alan',count: 67, sampleExcerpt: 'Sabah erken kalkıp yer tutmak zorunda...' },
        { subcategory: 'havuz',       count: 29, sampleExcerpt: 'Havuz suyu biraz bulanık görünüyordu...' }
      ],
      topPraises: [
        { subcategory: 'plaj_deniz',  count: 88, sampleExcerpt: 'Plaj çok güzel, denize kolay giriş...' }
      ]
    },
    {
      category: 'ANIM',
      gpi: 82.5, rawGpi: 81.0, reviewCount: 312,
      positiveCount: 198, negativeCount: 78, neutralCount: 36,
      trend: 0.3,
      topIssues: [
        { subcategory: 'gece_gosteri',count: 18, sampleExcerpt: 'Gece gösterileri biraz tekrardı...' }
      ],
      topPraises: [
        { subcategory: 'cocuk',       count: 54, sampleExcerpt: 'Çocuklarımız mini klüpte çok eğlendi...' }
      ]
    },
    {
      category: 'FRONT',
      gpi: 83.9, rawGpi: 83.1, reviewCount: 389,
      positiveCount: 265, negativeCount: 87, neutralCount: 37,
      trend: 1.0,
      topIssues: [
        { subcategory: 'check_in_out',count: 35, sampleExcerpt: 'Check-in için uzun süre bekledik...' }
      ],
      topPraises: [
        { subcategory: 'check_in_out',count: 98, sampleExcerpt: 'Karşılama çok sıcak ve hızlıydı...' }
      ]
    },
    {
      category: 'FACILITY',
      gpi: 80.2, rawGpi: 79.0, reviewCount: 298,
      positiveCount: 188, negativeCount: 82, neutralCount: 28,
      trend: -0.7,
      topIssues: [
        { subcategory: 'teknik_genel',count: 41, sampleExcerpt: 'Wi-Fi sinyali odada çok zayıftı...' }
      ],
      topPraises: [
        { subcategory: 'genel_gorunum',count: 77, sampleExcerpt: 'Ortak alanlar temiz ve bakımlıydı...' }
      ]
    },
    {
      category: 'VALUE',
      gpi: 75.8, rawGpi: 74.2, reviewCount: 534,
      positiveCount: 290, negativeCount: 177, neutralCount: 67,
      trend: -2.3,
      topIssues: [
        { subcategory: 'ekstra_ucret',  count: 58, sampleExcerpt: 'Her şey dahil dışında çok ekstra ücret...' },
        { subcategory: 'para_karsiligi',count: 44, sampleExcerpt: 'Fiyata göre bazı şeyler yetersiz...' }
      ],
      topPraises: [
        { subcategory: 'para_karsiligi',count: 67, sampleExcerpt: 'HEP kapsamı genişti, memnun kaldık...' }
      ]
    },
    {
      category: 'SPA',
      gpi: 86.1, rawGpi: 85.5, reviewCount: 143,
      positiveCount: 107, negativeCount: 24, neutralCount: 12,
      trend: 1.5,
      topIssues: [
        { subcategory: 'spa_wellness',  count: 12, sampleExcerpt: 'Masaj ücretleri biraz yüksek...' }
      ],
      topPraises: [
        { subcategory: 'spa_wellness',  count: 63, sampleExcerpt: 'Masaj harikaydı, kesinlikle tavsiye...' }
      ]
    },
    {
      category: 'GENERAL',
      gpi: 85.0, rawGpi: 84.3, reviewCount: 312,
      positiveCount: 234, negativeCount: 52, neutralCount: 26,
      trend: 0.8,
      topIssues: [],
      topPraises: [
        { subcategory: 'genel',         count: 189, sampleExcerpt: 'Kesinlikle tavsiye ederim, tekrar geleceğiz...' }
      ]
    }
  ]
};
