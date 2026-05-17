import type { Review } from '../types.js';

// Phase 1 mock per spec §7.3 (updated 2026-05-18 to use consolidated
// subcategory taxonomy — see categories.ts).
export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev_001',
    platform: 'tripadvisor',
    publishedDate: '2025-05-12T00:00:00Z',
    rating: 4,
    title: 'Güzel tatil, bazı eksiklikler var',
    text: 'Kahvaltı çok güzeldi ve çeşit boldu. Oda temizdi ama ses izolasyonu yetersizdi. Personel güleryüzlüydü. Havuzda şezlong bulmak sabahları zordu.',
    lang: 'tr',
    travelType: 'couples',
    sentiments: [
      { category: 'FOOD', subcategory: 'tat_cesit',   sentiment: 'positive', intensity: 0.9,  excerpt: 'Kahvaltı çok güzeldi ve çeşit boldu' },
      { category: 'ROOM', subcategory: 'temizlik',    sentiment: 'positive', intensity: 0.8,  excerpt: 'Oda temizdi' },
      { category: 'ROOM', subcategory: 'teknik_oda',  sentiment: 'negative', intensity: 0.7,  excerpt: 'ses izolasyonu yetersizdi' },
      { category: 'STAFF',subcategory: 'tutum',       sentiment: 'positive', intensity: 0.85, excerpt: 'Personel güleryüzlüydü' },
      { category: 'POOL', subcategory: 'sezlong_alan',sentiment: 'negative', intensity: 0.75, excerpt: 'şezlong bulmak sabahları zordu' }
    ]
  },
  {
    id: 'rev_002',
    platform: 'tripadvisor',
    publishedDate: '2025-05-10T00:00:00Z',
    rating: 5,
    title: 'Excellent family holiday',
    text: 'We had an amazing time at this hotel. The mini club was fantastic for our kids. The beach is beautiful and clean. Food quality was top notch especially the dinner buffet.',
    lang: 'en',
    travelType: 'family',
    sentiments: [
      { category: 'ANIM', subcategory: 'cocuk',       sentiment: 'positive', intensity: 0.95, excerpt: 'mini club was fantastic for our kids' },
      { category: 'POOL', subcategory: 'plaj_deniz',  sentiment: 'positive', intensity: 0.9,  excerpt: 'beach is beautiful and clean' },
      { category: 'FOOD', subcategory: 'tat_cesit',   sentiment: 'positive', intensity: 0.88, excerpt: 'dinner buffet top notch' }
    ],
    ownerResponse: 'Thank you so much for your kind words! We are thrilled you enjoyed your stay.'
  },
  {
    id: 'rev_003',
    platform: 'tripadvisor',
    publishedDate: '2025-05-08T00:00:00Z',
    rating: 3,
    title: 'Хорошо, но дорого',
    text: 'Отель хороший, но цены на дополнительные услуги очень высокие. Wi-Fi в номере слабый. Персонал вежливый, но не все говорят по-русски.',
    lang: 'ru',
    travelType: 'couples',
    sentiments: [
      // "Wi-Fi в номере слабый" → odadaki WiFi, ROOM/teknik_oda (DISAMBIGUATION_RULES)
      { category: 'VALUE', subcategory: 'ekstra_ucret', sentiment: 'negative', intensity: 0.8, excerpt: 'цены на дополнительные услуги очень высокие' },
      { category: 'ROOM',  subcategory: 'teknik_oda',   sentiment: 'negative', intensity: 0.7, excerpt: 'Wi-Fi в номере слабый' },
      { category: 'STAFF', subcategory: 'iletisim',     sentiment: 'negative', intensity: 0.6, excerpt: 'не все говорят по-русски' }
    ]
  }
];
