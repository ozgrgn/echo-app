/**
 * lib/mock/os.ts — ECHO OS (Genel lens) mock data.
 *
 * RULE (see ECHO_OS_DATA.md): real fields come from echo-ui's MOCK_HOTEL_SCORE /
 * MOCK_COMPETITORS (typed against echo-core). Fields that DON'T exist in the
 * backend yet (time-series, platform breakdown, department scores) are invented
 * HERE with explicit types and a `// [MOCK→radar]` / `// [MOCK→echo]` /
 * `// [MOCK→ops]` tag, so when the real source lands we know exactly what to swap.
 *
 * This keeps the "verileri görelim" promise: every mock value is labeled with its
 * future owner. Nothing here pretends a missing backend field is real.
 */

// ── Time-series (sparklines / trend / projection) — [MOCK→radar] ─────────────
// echo-backend stores snapshots but serves no series; radar's DailySnapshot will.
export interface KpiSpark {
	/** oldest → newest. */
	series: number[];
	/** delta vs previous point (for the DeltaBadge). */
	delta: number;
}

export interface OsKpis {
	gpi: KpiSpark;        // [MOCK→radar] series; value itself is [REAL] from HotelScore
	rpi: KpiSpark;        // [MOCK→radar]
	reviewCount: KpiSpark; // [MOCK→radar]
	responseRate: KpiSpark; // delta is [REAL] (rateTrend); series [MOCK→radar]
	competitorGap: KpiSpark; // [MOCK→radar]
}

export const MOCK_OS_KPIS: OsKpis = {
	gpi: { series: [66, 67, 69, 68, 70, 72, 71, 73, 72, 71, 70.6], delta: -1.2 },
	rpi: { series: [70, 70, 71, 71, 72, 72, 72.3], delta: 0.8 },
	reviewCount: { series: [240, 235, 228, 221, 210, 205, 196], delta: -18 },
	responseRate: { series: [2, 1, 1, 0, 0, 0, 0], delta: 0 },
	competitorGap: { series: [-2, -2.4, -2.8, -3, -3.1, -3.3, -3.4], delta: -0.6 }
};

// GPI trend with target line + dashed projection — [MOCK→radar] (proj = radar intel)
export interface TrendSeries {
	actual: number[];      // [MOCK→radar]
	projection: number[];  // [MOCK→radar] — radar "gidişat" forecast
	target: number;        // [MOCK→echo] — goal definition lives in echo
	ymin: number;
	ymax: number;
}

export const MOCK_OS_GPI_TREND: TrendSeries = {
	actual: [66, 67, 69, 68, 70, 72, 71, 73, 72, 71, 70.6],
	projection: [70.6, 70, 69.4, 69],
	target: 75,
	ymin: 60,
	ymax: 80
};

// ── Platform breakdown — [MOCK→echo] (HotelScore is blended, no per-platform) ──
export interface OsPlatform {
	key: 'tripadvisor' | 'booking' | 'google' | 'holidaycheck';
	label: string;
	score: string;        // display string incl. scale, e.g. "4.48"
	scale: string;        // "/5", "/10", "/6"
	sub: string;          // "196 yorum · GPI 70.6"
	trend: 'up' | 'down' | 'flat'; // [MOCK→radar]
	enters: boolean;      // clickable → platform universe
}

export const MOCK_OS_PLATFORMS: OsPlatform[] = [
	{ key: 'tripadvisor', label: 'TripAdvisor', score: '4.48', scale: '/5', sub: '196 yorum · GPI 70.6', trend: 'up', enters: true },
	{ key: 'booking', label: 'Booking', score: '8.1', scale: '/10', sub: '48 yorum · %32↓', trend: 'down', enters: true },
	{ key: 'google', label: 'Google', score: '4.3', scale: '/5', sub: '71 yorum · +0.2', trend: 'up', enters: true },
	{ key: 'holidaycheck', label: 'HolidayCheck', score: '5.2', scale: '/6', sub: '15 yorum', trend: 'flat', enters: false }
];

// Platform brand colors — [MOCK→echo] presentational; lives in token layer later.
// Single accent (used for chips, switcher, list rows).
export const PLATFORM_COLOR: Record<OsPlatform['key'], string> = {
	tripadvisor: '#00865a',
	booking: '#003b95',
	google: '#ea4335',
	holidaycheck: '#0091d5'
};

// Full per-platform palette — mirrors the prototype's three-tone treatment
// (soft hero bg / bright badge accent / deep text). Values copied from
// talkwo-echo-app.html (TA verified: soft #eafaf3, bright #34e0a1, deep #00865a).
export interface PlatformPalette {
	soft: string;   // hero background
	border: string; // hero border
	bright: string; // logo/badge fill
	deep: string;   // GPI number / text accent
	onBright: string; // text color on the bright fill
}
export const PLATFORM_PALETTE: Record<OsPlatform['key'], PlatformPalette> = {
	tripadvisor: { soft: '#eafaf3', border: '#bfe9dd', bright: '#34e0a1', deep: '#00865a', onBright: '#000' },
	booking: { soft: '#eef4ff', border: '#c7dbff', bright: '#1d4ed8', deep: '#003b95', onBright: '#fff' },
	google: { soft: '#fef1f0', border: '#f8ccc7', bright: '#ea4335', deep: '#c5221f', onBright: '#fff' },
	holidaycheck: { soft: '#e9f6fd', border: '#bce4f5', bright: '#0091d5', deep: '#0070a3', onBright: '#fff' }
};

// ── Department grid — [MOCK→ops] list, [MOCK→echo] scores ─────────────────────
// dept list from ops-engine /config/departments; scores need a dept→category
// responsibility map that does NOT exist yet (so scores are pure mock for now).
export interface OsDept {
	key: string;          // ops canonical key: 'hk','mnt','fnb','fo'...
	label: string;        // [MOCK→ops]
	score: number;        // [MOCK→echo] — needs responsibility map
	trend: 'up' | 'down' | 'flat'; // [MOCK→radar]
	scope: string;        // human hint of covered categories
	enters: boolean;
}

export const MOCK_OS_DEPTS: OsDept[] = [
	{ key: 'hk', label: 'Housekeeping', score: 61, trend: 'down', scope: 'Temizlik · Oda · Havuz', enters: true },
	{ key: 'fnb', label: 'F&B', score: 58, trend: 'down', scope: 'Yeme&İçme · Kahvaltı', enters: true },
	{ key: 'fo', label: 'Resepsiyon', score: 64, trend: 'down', scope: 'Check-in · Yanıt', enters: true },
	{ key: 'anm', label: 'Animasyon', score: 71, trend: 'up', scope: 'Animasyon · Çocuk', enters: true },
	{ key: 'mnt', label: 'Teknik', score: 67, trend: 'up', scope: 'Klima · Bakım · Arıza', enters: true },
	{ key: 'spa', label: 'SPA & Wellness', score: 85, trend: 'up', scope: 'Masaj · Hamam · Fitness', enters: true },
	{ key: 'pnb', label: 'Havuz & Plaj', score: 74, trend: 'flat', scope: 'Havuz · Plaj · Cankurtaran', enters: true },
	{ key: 'gr', label: 'Misafir İlişkileri', score: 70, trend: 'up', scope: 'Yanıt · Şikâyet · Memnuniyet', enters: true }
];

// ── Rail global counters — [MOCK→radar] (alerts) / [MOCK→echo] (goals) ─────────
export const MOCK_OS_COUNTERS = {
	openAlerts: 3,    // [MOCK→radar]
	atRiskGoals: 1    // [MOCK→echo] goal definitions + [MOCK→radar] risk verdict
};

// ── Rich demo HotelScore (blended + per-platform) ────────────────────────────
// For presentations: a believable, fully-populated dataset. Built from echo-ui's
// MOCK_HOTEL_SCORE (already rich: 14 categories, real Turkish excerpts) and
// shifted per platform so each universe reads distinctly. Returned by the OS
// loaders when osDataSource = 'mock'.
import type { HotelScore, CompetitorScore, CategoryScore } from '@talkwo/echo-core';
import { MOCK_HOTEL_SCORE, MOCK_COMPETITORS } from '@talkwo/echo-ui';

/** Shift every category/headline/gpi score by `delta`, clamped 0–100, so a
 *  platform variant looks distinct while keeping the rich category detail. */
function shiftScore(base: HotelScore, delta: number, overrides: Partial<HotelScore> = {}): HotelScore {
	const clamp = (n: number) => Math.max(0, Math.min(100, +(n + delta).toFixed(1)));
	const categoryScores: CategoryScore[] = base.categoryScores.map((c) => ({
		...c,
		headlineScore: clamp(c.headlineScore),
		aspectScore: c.aspectScore == null ? null : clamp(c.aspectScore),
	}));
	return {
		...base,
		gpi: clamp(base.gpi),
		headlineScore: clamp(base.headlineScore),
		aspectScore: base.aspectScore == null ? null : clamp(base.aspectScore),
		categoryScores,
		...overrides,
	};
}

/** Blended ('all') demo score — the rich base as-is. */
export const DEMO_HOTEL_SCORE: HotelScore = MOCK_HOTEL_SCORE;

/** Per-platform demo scores — each shifted + own review count for a distinct feel. */
export const DEMO_PLATFORM_SCORES: Record<string, HotelScore> = {
	tripadvisor: shiftScore(MOCK_HOTEL_SCORE, -1.1, { reviewCount: 196, avgStarRating: 4.48 }),
	booking: shiftScore(MOCK_HOTEL_SCORE, 1.9, { reviewCount: 255, avgStarRating: 4.58 }),
	google: shiftScore(MOCK_HOTEL_SCORE, 3.1, { reviewCount: 314, avgStarRating: 4.68 }),
	holidaycheck: shiftScore(MOCK_HOTEL_SCORE, 0.4, { reviewCount: 235, avgStarRating: 4.38 }),
};

/** Demo competitors for the RPI/Rakipler lens. */
export const DEMO_COMPETITORS: CompetitorScore[] = MOCK_COMPETITORS;
