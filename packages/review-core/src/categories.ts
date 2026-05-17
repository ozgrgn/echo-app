import type { CategoryMeta, CategoryKey } from './types.js';

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  FOOD: {
    key: 'FOOD', label: 'Yeme & İçme', labelEn: 'Food & Beverage',
    weight: 0.18,
    subcategories: ['kahvalti', 'aksam_yemegi', 'tat_cesit', 'ic_mekan_bar', 'dis_mekan_bar', 'servis_hizi'],
    department: 'F&B Müdürü'
  },
  ROOM: {
    key: 'ROOM', label: 'Oda', labelEn: 'Room',
    weight: 0.18,
    subcategories: ['temizlik', 'konfor_mobilya', 'ses_izolasyon', 'klima', 'banyo', 'manzara', 'koku'],
    department: 'Kat Hizmetleri Müdürü'
  },
  STAFF: {
    key: 'STAFF', label: 'Personel', labelEn: 'Staff',
    weight: 0.12,
    subcategories: ['ilgi_gurbet', 'dil_yetkinlik', 'profesyonellik', 'guler_yuz'],
    department: 'İnsan Kaynakları'
  },
  POOL: {
    key: 'POOL', label: 'Havuz & Plaj', labelEn: 'Pool & Beach',
    weight: 0.12,
    subcategories: ['havuz_temizlik', 'sezlong_yer', 'plaj_temizlik', 'deniz_giris', 'havuz_bar'],
    department: 'Aqua Müdürü'
  },
  ANIM: {
    key: 'ANIM', label: 'Animasyon', labelEn: 'Entertainment',
    weight: 0.08,
    subcategories: ['gece_show', 'gunduz_aktivite', 'cocuk_mini_club', 'spor_aktivite'],
    department: 'Animasyon Müdürü'
  },
  FRONT: {
    key: 'FRONT', label: 'Resepsiyon', labelEn: 'Front Office',
    weight: 0.08,
    subcategories: ['check_in', 'check_out', 'concierge', 'bekleme_suresi'],
    department: 'Ön Büro Müdürü'
  },
  FACILITY: {
    key: 'FACILITY', label: 'Tesis', labelEn: 'Facility',
    weight: 0.08,
    subcategories: ['genel_temizlik', 'bakim_durum', 'dukkanlar', 'otopark', 'wifi'],
    department: 'Teknik Müdür'
  },
  VALUE: {
    key: 'VALUE', label: 'Fiyat/Değer', labelEn: 'Value for Money',
    weight: 0.08,
    subcategories: ['fiyat_kalite', 'her_sey_dahil_kapsam', 'ekstra_ucret'],
    department: 'Genel Müdür'
  },
  SPA: {
    key: 'SPA', label: 'SPA & Wellness', labelEn: 'SPA & Wellness',
    weight: 0.04,
    subcategories: ['masaj_kalite', 'tesis_temizlik', 'personel_uzmanlik', 'fiyat'],
    department: 'SPA Müdürü'
  },
  GENERAL: {
    key: 'GENERAL', label: 'Genel', labelEn: 'General',
    weight: 0.04,
    subcategories: ['genel_deneyim', 'tavsiye', 'tekrar_ziyaret'],
    department: 'Genel Müdür'
  }
};

export const CATEGORY_LIST = Object.values(CATEGORIES);
export const TOTAL_WEIGHT = CATEGORY_LIST.reduce((s, c) => s + c.weight, 0); // = 1.0
