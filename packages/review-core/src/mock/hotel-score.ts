import type { HotelScore } from '../types.js';

// Full Phase 1 mock per spec §7.1 — 10 categories, realistic counts,
// trend deltas, top issues/praises. Numbers are designed to demo well:
// GPI 81.4 (yellow zone), RPI 100.1 ("Ortada"), 5 categories with negative
// trend so the "needs attention" UX surfaces non-trivially.
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
			gpi: 78.3,
			rawGpi: 76.1,
			reviewCount: 612,
			positiveCount: 380,
			negativeCount: 185,
			neutralCount: 47,
			trend: 1.2,
			topIssues: [
				{ subcategory: 'tat_cesit', count: 43, sampleExcerpt: 'Yemeklerin çeşidi yeterliydi ama...' },
				{ subcategory: 'servis_hizi', count: 31, sampleExcerpt: 'Serviste uzun bekleme süreleri...' }
			],
			topPraises: [
				{ subcategory: 'kahvalti', count: 89, sampleExcerpt: 'Kahvaltı çok zengin ve taze...' }
			]
		},
		{
			category: 'ROOM',
			gpi: 84.7,
			rawGpi: 83.9,
			reviewCount: 701,
			positiveCount: 489,
			negativeCount: 142,
			neutralCount: 70,
			trend: 0.5,
			topIssues: [
				{ subcategory: 'ses_izolasyon', count: 28, sampleExcerpt: 'Odadan koridoru duyuyorduk...' },
				{ subcategory: 'koku', count: 19, sampleExcerpt: 'Odada hafif nem kokusu vardı...' }
			],
			topPraises: [
				{ subcategory: 'temizlik', count: 134, sampleExcerpt: 'Oda tertemizdi, günlük temizlik...' },
				{ subcategory: 'manzara', count: 72, sampleExcerpt: 'Deniz manzarası harikaydı...' }
			]
		},
		{
			category: 'STAFF',
			gpi: 87.2,
			rawGpi: 86.8,
			reviewCount: 523,
			positiveCount: 387,
			negativeCount: 78,
			neutralCount: 58,
			trend: 2.1,
			topIssues: [
				{ subcategory: 'dil_yetkinlik', count: 22, sampleExcerpt: 'İngilizce konuşan az personel...' }
			],
			topPraises: [
				{ subcategory: 'ilgi_gurbet', count: 165, sampleExcerpt: 'Personel çok ilgili ve güler yüzlüydü...' }
			]
		},
		{
			category: 'POOL',
			gpi: 79.1,
			rawGpi: 77.3,
			reviewCount: 445,
			positiveCount: 267,
			negativeCount: 134,
			neutralCount: 44,
			trend: -1.8,
			topIssues: [
				{ subcategory: 'sezlong_yer', count: 67, sampleExcerpt: 'Sabah erken kalkıp yer tutmak zorunda...' },
				{ subcategory: 'havuz_temizlik', count: 29, sampleExcerpt: 'Havuz suyu biraz bulanık görünüyordu...' }
			],
			topPraises: [
				{ subcategory: 'deniz_giris', count: 88, sampleExcerpt: 'Plaj çok güzel, denize kolay giriş...' }
			]
		},
		{
			category: 'ANIM',
			gpi: 82.5,
			rawGpi: 81.0,
			reviewCount: 312,
			positiveCount: 198,
			negativeCount: 78,
			neutralCount: 36,
			trend: 0.3,
			topIssues: [
				{ subcategory: 'gece_show', count: 18, sampleExcerpt: 'Gece gösterileri biraz tekrardı...' }
			],
			topPraises: [
				{ subcategory: 'cocuk_mini_club', count: 54, sampleExcerpt: 'Çocuklarımız mini klüpte çok eğlendi...' }
			]
		},
		{
			category: 'FRONT',
			gpi: 83.9,
			rawGpi: 83.1,
			reviewCount: 389,
			positiveCount: 265,
			negativeCount: 87,
			neutralCount: 37,
			trend: 1.0,
			topIssues: [
				{ subcategory: 'bekleme_suresi', count: 35, sampleExcerpt: 'Check-in için uzun süre bekledik...' }
			],
			topPraises: [
				{ subcategory: 'check_in', count: 98, sampleExcerpt: 'Karşılama çok sıcak ve hızlıydı...' }
			]
		},
		{
			category: 'FACILITY',
			gpi: 80.2,
			rawGpi: 79.0,
			reviewCount: 298,
			positiveCount: 188,
			negativeCount: 82,
			neutralCount: 28,
			trend: -0.7,
			topIssues: [
				{ subcategory: 'wifi', count: 41, sampleExcerpt: 'Wi-Fi sinyali odada çok zayıftı...' }
			],
			topPraises: [
				{ subcategory: 'genel_temizlik', count: 77, sampleExcerpt: 'Ortak alanlar temiz ve bakımlıydı...' }
			]
		},
		{
			category: 'VALUE',
			gpi: 75.8,
			rawGpi: 74.2,
			reviewCount: 534,
			positiveCount: 290,
			negativeCount: 177,
			neutralCount: 67,
			trend: -2.3,
			topIssues: [
				{ subcategory: 'ekstra_ucret', count: 58, sampleExcerpt: 'Her şey dahil dışında çok ekstra ücret...' },
				{ subcategory: 'fiyat_kalite', count: 44, sampleExcerpt: 'Fiyata göre bazı şeyler yetersiz...' }
			],
			topPraises: [
				{ subcategory: 'her_sey_dahil_kapsam', count: 67, sampleExcerpt: 'HEP kapsamı genişti, memnun kaldık...' }
			]
		},
		{
			category: 'SPA',
			gpi: 86.1,
			rawGpi: 85.5,
			reviewCount: 143,
			positiveCount: 107,
			negativeCount: 24,
			neutralCount: 12,
			trend: 1.5,
			topIssues: [
				{ subcategory: 'fiyat', count: 12, sampleExcerpt: 'Masaj ücretleri biraz yüksek...' }
			],
			topPraises: [
				{ subcategory: 'masaj_kalite', count: 63, sampleExcerpt: 'Masaj harikaydı, kesinlikle tavsiye...' }
			]
		},
		{
			category: 'GENERAL',
			gpi: 85.0,
			rawGpi: 84.3,
			reviewCount: 312,
			positiveCount: 234,
			negativeCount: 52,
			neutralCount: 26,
			trend: 0.8,
			topIssues: [],
			topPraises: [
				{ subcategory: 'tavsiye', count: 189, sampleExcerpt: 'Kesinlikle tavsiye ederim, tekrar geleceğiz...' }
			]
		}
	]
};
