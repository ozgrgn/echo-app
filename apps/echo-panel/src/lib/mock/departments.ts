/**
 * lib/mock/departments.ts — rich department-lens demo data (8 departments).
 *
 * Each department carries the full detail set from the prototype's HK view:
 * header score/target/progress, a score trend series, ALL its subcategories
 * (the "alt kırılım" breakdown: name · taxonomy category · score · mentions ·
 * trend), the complaints dragging it down, active goals (start→current→target),
 * and the highest-leverage fixes ("hedefe en hızlı yol").
 *
 * All [MOCK] — presentation data. Department→subcategory ownership and goal
 * intelligence are future backend/radar work (see ECHO_OS_PLAN.md).
 */

export type Trend = 'up' | 'down' | 'flat';

export interface DeptSub {
	name: string;       // subcategory display name
	cat: string;        // taxonomy category it rolls up to (ROOM, POOL, FOOD…)
	score: number;      // 0–100
	mentions: number;
	trend: Trend;
}

export interface DeptGoal {
	name: string;
	scope: string;      // e.g. "ROOM", "HK geneli"
	start: number;
	current: number;
	target: number;
	status: 'risk' | 'ok';
	due: string;        // e.g. "31 Tem"
}

export interface DeptIssue {
	category: string;
	subcategory: string;
	excerpt: string;
	count: number;
}

export interface DeptOpportunity {
	label: string;
	context: string;    // "47 puan · 31 mention · …"
	lift: string;       // "+3.1"
}

export interface DeptDetail {
	key: string;
	label: string;
	icon: string;       // lucide name
	color: string;      // accent
	score: number;
	target: number;
	progressPct: number;        // toward target
	scoreTrend: number[];       // series, oldest→newest
	trendDir: Trend;
	reviewCount: number;        // related reviews/month
	subScopeCount: number;      // "N alt-başlıktan sorumlu"
	subs: DeptSub[];
	goals: DeptGoal[];
	issues: DeptIssue[];
	opportunities: DeptOpportunity[];
}

export const DEPARTMENTS: Record<string, DeptDetail> = {
	hk: {
		key: 'hk', label: 'Housekeeping', icon: 'bed-double', color: '#7c5cff',
		score: 61, target: 72, progressPct: 18, trendDir: 'down', reviewCount: 184, subScopeCount: 10,
		scoreTrend: [68, 67, 65, 64, 63, 62, 61.5, 61],
		subs: [
			{ name: 'Oda Temizliği', cat: 'ROOM', score: 55, mentions: 68, trend: 'down' },
			{ name: 'Havlu & Çarşaf', cat: 'ROOM', score: 64, mentions: 28, trend: 'flat' },
			{ name: 'Banyo & Duş', cat: 'ROOM', score: 52, mentions: 41, trend: 'down' },
			{ name: 'Klima', cat: 'ROOM', score: 47, mentions: 31, trend: 'down' },
			{ name: 'Oda Bakımı', cat: 'ROOM', score: 58, mentions: 22, trend: 'down' },
			{ name: 'Oda Gürültüsü', cat: 'ROOM', score: 49, mentions: 19, trend: 'flat' },
			{ name: 'Havuz Temizliği', cat: 'POOL', score: 51, mentions: 33, trend: 'down' },
			{ name: 'Havuz Havlusu', cat: 'POOL', score: 61, mentions: 12, trend: 'up' },
			{ name: 'Ortak Alan Temizliği', cat: 'FACILITY', score: 66, mentions: 24, trend: 'up' },
			{ name: 'Genel Bakım', cat: 'FACILITY', score: 57, mentions: 18, trend: 'flat' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'HK geneli', start: 64, current: 61, target: 72, status: 'risk', due: '31 Tem' },
			{ name: 'Oda Temizliği', scope: 'ROOM', start: 58, current: 55, target: 68, status: 'risk', due: '15 Tem' },
			{ name: 'Havuz Temizliği', scope: 'POOL', start: 54, current: 51, target: 65, status: 'ok', due: '31 Tem' },
		],
		issues: [
			{ category: 'Oda', subcategory: 'oda sıcaklığı / klima', excerpt: 'Klima geceleri yeterince soğutmuyordu.', count: 31 },
			{ category: 'Havuz', subcategory: 'havuz temizliği', excerpt: 'Havuz kenarı sabah temiz değildi.', count: 18 },
			{ category: 'Oda', subcategory: 'banyo temizliği', excerpt: 'Banyo zemini tam temizlenmemişti.', count: 13 },
			{ category: 'Oda', subcategory: 'oda bakımı', excerpt: 'Lavabo akıyordu, geç ilgilenildi.', count: 9 },
		],
		opportunities: [
			{ label: 'Klima', context: '47 puan · 31 mention · "geceleri soğutmuyor"', lift: '+3.1' },
			{ label: 'Havuz Temizliği', context: '51 puan · 33 mention · "sabah kirli"', lift: '+2.4' },
			{ label: 'Banyo & Duş', context: '52 puan · 41 mention · "zemin/küf"', lift: '+1.8' },
		],
	},

	fnb: {
		key: 'fnb', label: 'F&B', icon: 'utensils-crossed', color: '#e8590c',
		score: 58, target: 70, progressPct: 22, trendDir: 'down', reviewCount: 221, subScopeCount: 8,
		scoreTrend: [63, 62, 61, 60, 59, 58.5, 58, 58],
		subs: [
			{ name: 'Akşam Yemeği', cat: 'FOOD', score: 53, mentions: 88, trend: 'down' },
			{ name: 'Kahvaltı', cat: 'FOOD', score: 79, mentions: 76, trend: 'up' },
			{ name: 'Yemek Çeşitliliği', cat: 'FOOD', score: 51, mentions: 64, trend: 'down' },
			{ name: 'Lezzet / Kalite', cat: 'FOOD', score: 56, mentions: 58, trend: 'down' },
			{ name: 'A La Carte', cat: 'FOOD', score: 62, mentions: 34, trend: 'flat' },
			{ name: 'Servis Hızı', cat: 'FOOD', score: 54, mentions: 41, trend: 'down' },
			{ name: 'Bar / İçecek', cat: 'FOOD', score: 60, mentions: 29, trend: 'up' },
			{ name: 'Tatlı / Pasta', cat: 'FOOD', score: 67, mentions: 21, trend: 'flat' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'F&B geneli', start: 61, current: 58, target: 70, status: 'risk', due: '31 Tem' },
			{ name: 'Akşam Yemeği', scope: 'FOOD', start: 55, current: 53, target: 66, status: 'risk', due: '20 Tem' },
			{ name: 'Servis Hızı', scope: 'FOOD', start: 56, current: 54, target: 64, status: 'ok', due: '31 Tem' },
		],
		issues: [
			{ category: 'Yeme&İçme', subcategory: 'akşam menüsü çeşitliliği', excerpt: 'Akşam menüsü her gün benziyordu.', count: 34 },
			{ category: 'Yeme&İçme', subcategory: 'servis süresi', excerpt: 'Yemek için uzun süre bekledik.', count: 22 },
			{ category: 'Yeme&İçme', subcategory: 'lezzet', excerpt: 'Yemekler soğuk ve tatsızdı.', count: 17 },
		],
		opportunities: [
			{ label: 'Akşam Yemeği', context: '53 puan · 88 mention · "tekrar ediyor"', lift: '+4.2' },
			{ label: 'Yemek Çeşitliliği', context: '51 puan · 64 mention · "az seçenek"', lift: '+2.9' },
			{ label: 'Servis Hızı', context: '54 puan · 41 mention · "yavaş"', lift: '+1.7' },
		],
	},

	fo: {
		key: 'fo', label: 'Resepsiyon', icon: 'concierge-bell', color: '#1d4ed8',
		score: 64, target: 75, progressPct: 35, trendDir: 'down', reviewCount: 96, subScopeCount: 5,
		scoreTrend: [67, 66, 66, 65, 64, 64, 63.5, 64],
		subs: [
			{ name: 'Check-in', cat: 'FRONT', score: 58, mentions: 47, trend: 'down' },
			{ name: 'Check-out', cat: 'FRONT', score: 66, mentions: 23, trend: 'flat' },
			{ name: 'Karşılama', cat: 'FRONT', score: 78, mentions: 31, trend: 'up' },
			{ name: 'Yanıt Hızı', cat: 'FRONT', score: 61, mentions: 28, trend: 'down' },
			{ name: 'Bilgilendirme', cat: 'FRONT', score: 63, mentions: 19, trend: 'flat' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'FO geneli', start: 67, current: 64, target: 75, status: 'risk', due: '31 Tem' },
			{ name: 'Check-in', scope: 'FRONT', start: 62, current: 58, target: 72, status: 'risk', due: '15 Tem' },
		],
		issues: [
			{ category: 'Resepsiyon', subcategory: 'check-in bekleme', excerpt: 'Giriş işlemi uzun sürdü, sırada bekledik.', count: 22 },
			{ category: 'Resepsiyon', subcategory: 'bilgilendirme', excerpt: 'Otel olanakları hakkında bilgi verilmedi.', count: 11 },
		],
		opportunities: [
			{ label: 'Check-in', context: '58 puan · 47 mention · "uzun bekleme"', lift: '+2.6' },
			{ label: 'Yanıt Hızı', context: '61 puan · 28 mention · "geç dönüş"', lift: '+1.4' },
		],
	},

	anm: {
		key: 'anm', label: 'Animasyon', icon: 'party-popper', color: '#059669',
		score: 71, target: 78, progressPct: 54, trendDir: 'up', reviewCount: 132, subScopeCount: 5,
		scoreTrend: [66, 67, 68, 69, 70, 70.5, 71, 71],
		subs: [
			{ name: 'Gündüz Aktiviteleri', cat: 'ENTERTAINMENT', score: 73, mentions: 54, trend: 'up' },
			{ name: 'Gece Şovları', cat: 'ENTERTAINMENT', score: 69, mentions: 48, trend: 'flat' },
			{ name: 'Çocuk Kulübü', cat: 'KIDS', score: 76, mentions: 43, trend: 'up' },
			{ name: 'Müzik / DJ', cat: 'ENTERTAINMENT', score: 64, mentions: 27, trend: 'down' },
			{ name: 'Spor / Turnuva', cat: 'ENTERTAINMENT', score: 70, mentions: 19, trend: 'up' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'ANM geneli', start: 66, current: 71, target: 78, status: 'ok', due: '31 Tem' },
			{ name: 'Gece Şovları', scope: 'ENTERTAINMENT', start: 65, current: 69, target: 76, status: 'ok', due: '31 Tem' },
		],
		issues: [
			{ category: 'Animasyon', subcategory: 'müzik sesi', excerpt: 'Gece müziği çok yüksekti, uyuyamadık.', count: 14 },
			{ category: 'Animasyon', subcategory: 'gece şovu', excerpt: 'Şovlar tekrar ediyordu.', count: 9 },
		],
		opportunities: [
			{ label: 'Müzik / DJ', context: '64 puan · 27 mention · "ses yüksek"', lift: '+1.8' },
			{ label: 'Gece Şovları', context: '69 puan · 48 mention · "tekrar"', lift: '+1.2' },
		],
	},

	mnt: {
		key: 'mnt', label: 'Teknik', icon: 'wrench', color: '#0891b2',
		score: 67, target: 76, progressPct: 41, trendDir: 'up', reviewCount: 88, subScopeCount: 6,
		scoreTrend: [62, 63, 64, 65, 66, 66.5, 67, 67],
		subs: [
			{ name: 'Klima Arızası', cat: 'ROOM', score: 58, mentions: 36, trend: 'up' },
			{ name: 'Su / Tesisat', cat: 'ROOM', score: 64, mentions: 24, trend: 'flat' },
			{ name: 'Elektrik / Aydınlatma', cat: 'FACILITY', score: 71, mentions: 18, trend: 'up' },
			{ name: 'Asansör', cat: 'FACILITY', score: 69, mentions: 14, trend: 'flat' },
			{ name: 'Wi-Fi / İnternet', cat: 'FACILITY', score: 62, mentions: 41, trend: 'down' },
			{ name: 'Genel Arıza Yanıtı', cat: 'FACILITY', score: 73, mentions: 22, trend: 'up' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'MNT geneli', start: 62, current: 67, target: 76, status: 'ok', due: '31 Tem' },
			{ name: 'Wi-Fi / İnternet', scope: 'FACILITY', start: 60, current: 62, target: 74, status: 'risk', due: '20 Tem' },
		],
		issues: [
			{ category: 'Tesis', subcategory: 'wi-fi', excerpt: 'Odada internet çok yavaştı.', count: 26 },
			{ category: 'Oda', subcategory: 'klima arızası', excerpt: 'Klima bozuktu, 2 gün beklendi.', count: 12 },
		],
		opportunities: [
			{ label: 'Wi-Fi / İnternet', context: '62 puan · 41 mention · "yavaş"', lift: '+2.3' },
			{ label: 'Klima Arızası', context: '58 puan · 36 mention · "geç müdahale"', lift: '+2.0' },
		],
	},

	spa: {
		key: 'spa', label: 'SPA & Wellness', icon: 'flower-2', color: '#db2777',
		score: 85, target: 88, progressPct: 62, trendDir: 'up', reviewCount: 64, subScopeCount: 4,
		scoreTrend: [81, 82, 83, 84, 84.5, 85, 85, 85],
		subs: [
			{ name: 'Masaj', cat: 'SPA', score: 87, mentions: 41, trend: 'up' },
			{ name: 'Hamam / Sauna', cat: 'SPA', score: 84, mentions: 28, trend: 'flat' },
			{ name: 'Fitness', cat: 'SPA', score: 80, mentions: 19, trend: 'up' },
			{ name: 'Randevu / Rezervasyon', cat: 'SPA', score: 82, mentions: 12, trend: 'flat' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'SPA geneli', start: 81, current: 85, target: 88, status: 'ok', due: '31 Tem' },
		],
		issues: [
			{ category: 'SPA', subcategory: 'fitness ekipmanı', excerpt: 'Bazı aletler eskiydi.', count: 7 },
		],
		opportunities: [
			{ label: 'Fitness', context: '80 puan · 19 mention · "eski ekipman"', lift: '+0.9' },
		],
	},

	pnb: {
		key: 'pnb', label: 'Havuz & Plaj', icon: 'droplets', color: '#0ea5e9',
		score: 74, target: 80, progressPct: 47, trendDir: 'flat', reviewCount: 118, subScopeCount: 5,
		scoreTrend: [73, 74, 74, 73, 74, 74, 74, 74],
		subs: [
			{ name: 'Havuz Genel', cat: 'POOL', score: 76, mentions: 62, trend: 'flat' },
			{ name: 'Plaj', cat: 'BEACH', score: 81, mentions: 48, trend: 'up' },
			{ name: 'Şezlong / Şemsiye', cat: 'POOL', score: 64, mentions: 37, trend: 'down' },
			{ name: 'Deniz Erişimi', cat: 'BEACH', score: 78, mentions: 21, trend: 'flat' },
			{ name: 'Cankurtaran / Güvenlik', cat: 'BEACH', score: 79, mentions: 14, trend: 'up' },
		],
		goals: [
			{ name: 'Departman skoru', scope: 'PNB geneli', start: 73, current: 74, target: 80, status: 'risk', due: '31 Tem' },
			{ name: 'Şezlong / Şemsiye', scope: 'POOL', start: 66, current: 64, target: 74, status: 'risk', due: '20 Tem' },
		],
		issues: [
			{ category: 'Havuz', subcategory: 'şezlong yetersizliği', excerpt: 'Sabah şezlong bulmak imkansızdı.', count: 24 },
		],
		opportunities: [
			{ label: 'Şezlong / Şemsiye', context: '64 puan · 37 mention · "yetersiz"', lift: '+2.1' },
		],
	},

	gr: {
		key: 'gr', label: 'Misafir İlişkileri', icon: 'heart-handshake', color: '#9333ea',
		score: 70, target: 80, progressPct: 33, trendDir: 'up', reviewCount: 142, subScopeCount: 4,
		scoreTrend: [66, 67, 68, 68, 69, 69.5, 70, 70],
		subs: [
			{ name: 'Yorum Yanıt Oranı', cat: 'GENERAL', score: 42, mentions: 0, trend: 'down' },
			{ name: 'Şikâyet Çözümü', cat: 'GENERAL', score: 68, mentions: 34, trend: 'up' },
			{ name: 'Genel Memnuniyet', cat: 'GENERAL', score: 85, mentions: 98, trend: 'up' },
			{ name: 'Karşılama / Uğurlama', cat: 'GENERAL', score: 81, mentions: 27, trend: 'flat' },
		],
		goals: [
			{ name: 'Yanıt Oranı', scope: 'GENERAL', start: 0, current: 42, target: 80, status: 'risk', due: '15 Tem' },
			{ name: 'Departman skoru', scope: 'GR geneli', start: 66, current: 70, target: 80, status: 'ok', due: '31 Tem' },
		],
		issues: [
			{ category: 'Genel', subcategory: 'yanıtsız yorum', excerpt: 'Olumsuz yorumlara yanıt verilmemiş.', count: 28 },
		],
		opportunities: [
			{ label: 'Yorum Yanıt Oranı', context: '42 puan · "yanıtsız birikim"', lift: '+5.0' },
		],
	},
};

export const DEPARTMENT_KEYS = Object.keys(DEPARTMENTS);
