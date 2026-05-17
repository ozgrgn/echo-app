import type { CategoryKey, CategoryMeta } from './types.js';

/**
 * Revora ana kategori taksonomisi (10 üst kategori).
 *
 * Subcategory listeleri — seed list, sabit enum değil. ABSA pipeline
 * runtime'da yeni subcategory üretebilir. Level-3 granularity excerpt
 * ve keyword'de yaşar; bu seviyede ayrı bir hierarchy yok.
 *
 * Disambiguation kuralları — DISAMBIGUATION_RULES altında. LLM ABSA
 * prompt'unda bu kurallar kullanılır; frontend tüketmez ama tek bir
 * source of truth olarak burada saklanır.
 */
export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
	FOOD: {
		key: 'FOOD',
		label: 'Yeme & İçme',
		labelEn: 'Food & Beverage',
		weight: 0.18,
		subcategories: ['tat_cesit', 'icecek_bar', 'servis_hiz', 'ozel_restoran'],
		department: 'F&B Müdürü'
	},
	ROOM: {
		key: 'ROOM',
		label: 'Oda',
		labelEn: 'Room',
		weight: 0.18,
		subcategories: ['temizlik', 'konfor', 'havlu_carsaf', 'teknik_oda'],
		department: 'Kat Hizmetleri Müdürü'
	},
	STAFF: {
		key: 'STAFF',
		label: 'Personel',
		labelEn: 'Staff',
		weight: 0.12,
		subcategories: ['tutum', 'iletisim', 'cozum'],
		department: 'İnsan Kaynakları'
	},
	POOL: {
		key: 'POOL',
		label: 'Havuz & Plaj',
		labelEn: 'Pool & Beach',
		weight: 0.12,
		subcategories: ['havuz', 'plaj_deniz', 'sezlong_alan'],
		department: 'Aqua Müdürü'
	},
	ANIM: {
		key: 'ANIM',
		label: 'Animasyon',
		labelEn: 'Entertainment',
		weight: 0.08,
		subcategories: ['gunduz', 'gece_gosteri', 'cocuk'],
		department: 'Animasyon Müdürü'
	},
	FRONT: {
		key: 'FRONT',
		label: 'Resepsiyon',
		labelEn: 'Front Office',
		weight: 0.08,
		subcategories: ['check_in_out', 'bilgi_destek'],
		department: 'Ön Büro Müdürü'
	},
	FACILITY: {
		key: 'FACILITY',
		label: 'Tesis',
		labelEn: 'Facility',
		weight: 0.08,
		subcategories: ['genel_gorunum', 'teknik_genel', 'konum'],
		department: 'Teknik Müdür'
	},
	VALUE: {
		key: 'VALUE',
		label: 'Fiyat/Değer',
		labelEn: 'Value for Money',
		weight: 0.08,
		subcategories: ['para_karsiligi', 'ekstra_ucret'],
		department: 'Genel Müdür'
	},
	SPA: {
		key: 'SPA',
		label: 'SPA & Wellness',
		labelEn: 'SPA & Wellness',
		weight: 0.04,
		subcategories: ['spa_wellness', 'fitness'],
		department: 'SPA Müdürü'
	},
	GENERAL: {
		key: 'GENERAL',
		label: 'Genel',
		labelEn: 'General',
		weight: 0.04,
		subcategories: ['genel'],
		department: 'Genel Müdür'
	}
};

export const CATEGORY_LIST = Object.values(CATEGORIES);
export const TOTAL_WEIGHT = CATEGORY_LIST.reduce((s, c) => s + c.weight, 0); // = 1.0

// ─── Disambiguation rules ───────────────────────────────────────────────────
//
// ABSA pipeline'ı yorumdaki belirsiz/sınır durumda hangi kategoriye atanacak
// kuralları. LLM system prompt'una direkt eklenir (BE handover sonrası).
// Frontend bu listeyi tüketmez — burada single source of truth olarak yaşar.

export interface DisambiguationRule {
	pattern: string;            // örnek/tetikleyici yorum kalıbı (Türkçe)
	category: CategoryKey;
	subcategory: string;
	excludeCategories: CategoryKey[];  // bilerek atanmayacak kategoriler
	rationale?: string;
}

export const DISAMBIGUATION_RULES: DisambiguationRule[] = [
	{
		pattern: 'Havlu gelmedi',
		category: 'ROOM',
		subcategory: 'havlu_carsaf',
		excludeCategories: ['POOL', 'STAFF'],
		rationale: 'Havlu eksikliği odanın gereği — havuz/plaj ya da personel kategorisine gitmemeli.'
	},
	{
		pattern: 'Garson yavaştı',
		category: 'FOOD',
		subcategory: 'servis_hiz',
		excludeCategories: ['STAFF'],
		rationale: 'F&B servis hızı sorunu; personel genel kategorisi değil.'
	},
	{
		pattern: 'Resepsiyoncu kabaydı',
		category: 'FRONT',
		subcategory: 'bilgi_destek',
		excludeCategories: ['STAFF'],
		rationale: 'Resepsiyon spesifik departman; staff genel kategorisi değil.'
	},
	{
		pattern: 'Herkes çok iyiydi',
		category: 'STAFF',
		subcategory: 'tutum',
		excludeCategories: ['FRONT', 'FOOD', 'ROOM'],
		rationale: 'Generic personel övgüsü — spesifik bir departmana atanamaz.'
	},
	{
		pattern: 'Yiyecek alanı kirli',
		category: 'FACILITY',
		subcategory: 'genel_gorunum',
		excludeCategories: ['FOOD', 'ROOM'],
		rationale: 'Fiziksel alan temizliği tesise ait — F&B operasyonu ya da oda kategorisi değil.'
	},
	{
		pattern: 'Odada WiFi yoktu',
		category: 'ROOM',
		subcategory: 'teknik_oda',
		excludeCategories: ['FACILITY'],
		rationale: 'Oda içi teknik sorun — oda kategorisinin altında.'
	},
	{
		pattern: 'Lobide WiFi yoktu',
		category: 'FACILITY',
		subcategory: 'teknik_genel',
		excludeCategories: ['ROOM'],
		rationale: 'Ortak alanda teknik sorun — tesis kategorisi.'
	},
	{
		pattern: 'Havuz kötüydü',
		category: 'POOL',
		subcategory: 'havuz',
		excludeCategories: ['FACILITY'],
		rationale: 'Havuz operasyonu ayrı kategori; tesis genel görünümü değil.'
	}
];
