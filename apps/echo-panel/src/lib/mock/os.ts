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
	/** Raw signed trend delta (period-over-period). Used to RANK the movement lists
	 *  (most-negative first) and to show the exact ± value — a threshold only bucketed
	 *  the direction and hid it. Optional so the mock set stays valid without it. */
	trendValue?: number;
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

// ── Management response analytics ────────────────────────────────────────────
// UPDATE: byPlatform / bySentiment are now [REAL] — served by /v1/responses/stats
// and wired in the OS loader (toResponseRows). MOCK_OS_RESPONSE below is retained
// for: (1) demo/mock source mode, and (2) the competitorAvgRate ("Pazar") benchmark,
// which is still [MOCK→radar] until radar serves a market response-rate rollup.
// Rates are 0..1.
export interface ResponseRateRow {
	key: string;
	label: string;
	/** answered / total, 0..1. */
	rate: number;
	responded: number;
	total: number;
}

export interface ResponseAnalytics {
	/** Per-platform response rate. [MOCK→radar] */
	byPlatform: ResponseRateRow[];
	/** Per-sentiment response rate (do we answer the angry ones?). [MOCK→radar] */
	bySentiment: ResponseRateRow[];
	/** Market average response rate to benchmark against. [MOCK→radar] */
	competitorAvgRate: number;
}

export const MOCK_OS_RESPONSE: ResponseAnalytics = {
	byPlatform: [
		{ key: 'google', label: 'Google', rate: 0.87, responded: 412, total: 474 },
		{ key: 'tripadvisor', label: 'TripAdvisor', rate: 0.61, responded: 188, total: 308 },
		{ key: 'booking', label: 'Booking', rate: 0.74, responded: 233, total: 315 },
		{ key: 'holidaycheck', label: 'HolidayCheck', rate: 0.52, responded: 64, total: 123 }
	],
	bySentiment: [
		{ key: 'negative', label: 'Olumsuz', rate: 0.43, responded: 86, total: 200 },
		{ key: 'neutral', label: 'Nötr', rate: 0.58, responded: 145, total: 250 },
		{ key: 'positive', label: 'Olumlu', rate: 0.81, responded: 666, total: 822 }
	],
	competitorAvgRate: 0.69
};

// Per-platform / per-department response slice — [MOCK→radar]. Derived
// deterministically from a string key so each lens reads distinctly but stably
// (no Math.random → same demo every render). Real source: radar response-rollup.
function keyShift(key: string): number {
	// Stable -0.12..+0.12 offset from the key's char codes.
	let h = 0;
	for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 1000;
	return (h / 1000) * 0.24 - 0.12;
}
const clamp01 = (n: number) => Math.max(0.05, Math.min(0.98, n));

// Per-platform GPI trend series — [MOCK→radar]. Backend serves a single period;
// radar's DailySnapshot will own the real series. Derived deterministically: a
// gently rising/falling path that LANDS on the platform's real current GPI, so
// the chart's last point matches the headline. Seeded by key for stable variety.
export function platformTrendFor(key: string, currentGpi: number, points = 8): {
	actual: number[];
	ymin: number;
	ymax: number;
} {
	const s = keyShift(key); // -0.12..+0.12
	const span = 6 + Math.abs(s) * 20; // how far back the series started
	const start = currentGpi - span * (s >= 0 ? 1 : 0.4); // up-trend if s>=0
	const series: number[] = [];
	for (let i = 0; i < points; i++) {
		const t = i / (points - 1);
		// ease-in toward the current value, with a small key-seeded wobble.
		const base = start + (currentGpi - start) * (t * t * (3 - 2 * t));
		const wobble = Math.sin((i + key.length) * 1.3) * 0.6;
		series.push(+(base + wobble).toFixed(1));
	}
	series[points - 1] = +currentGpi.toFixed(1); // land exactly on current
	const lo = Math.min(...series), hi = Math.max(...series);
	return { actual: series, ymin: Math.floor(lo - 4), ymax: Math.ceil(hi + 4) };
}

/** Sentiment-split response rates + overall, scoped to one platform/department. */
export function responseSliceFor(key: string, overallRate: number): {
	overallRate: number;
	bySentiment: ResponseRateRow[];
	competitorAvgRate: number;
} {
	const s = keyShift(key);
	const neg = clamp01(0.43 + s);
	const neu = clamp01(0.58 + s * 0.7);
	const pos = clamp01(0.81 + s * 0.4);
	return {
		overallRate: clamp01(overallRate + s * 0.5),
		bySentiment: [
			{ key: 'negative', label: 'Olumsuz', rate: neg, responded: Math.round(neg * 200), total: 200 },
			{ key: 'neutral', label: 'Nötr', rate: neu, responded: Math.round(neu * 250), total: 250 },
			{ key: 'positive', label: 'Olumlu', rate: pos, responded: Math.round(pos * 822), total: 822 }
		],
		competitorAvgRate: MOCK_OS_RESPONSE.competitorAvgRate
	};
}

// ── Demo audience segments (language + tripType) — shape matches /v1/segments ──
// Mirrors the real endpoint's response so the Genel lens renders the same way in
// mock mode. Numbers are illustrative; live source: GET /v1/segments.
export const DEMO_SEGMENTS = {
	total: 2377,
	languageKnown: 642,
	byLanguage: [
		{ key: 'unknown', count: 1735 },
		{ key: 'en', count: 388 },
		{ key: 'de', count: 121 },
		{ key: 'tr', count: 73 },
		{ key: 'ru', count: 40 },
		{ key: 'pl', count: 20 }
	],
	tripTypeKnown: 461,
	byTripType: [
		{ key: 'unknown', count: 1916 },
		{ key: 'FAMILY', count: 224 },
		{ key: 'COUPLES', count: 132 },
		{ key: 'FRIENDS', count: 71 },
		{ key: 'SOLO', count: 34 }
	]
};

// ── Demo GPI history (time-series) — shape matches /v1/scores/:slug/history ────
// Mock-mode stand-in so the Genel lens trend chart renders without a backend.
// Live source: the real backfilled score_snapshots series.
export const DEMO_HISTORY = [
	{ period: '2025-07', scoredAt: '2025-07-15T03:00:00.000Z', gpi: 68.6, reviewCount: 1920 },
	{ period: '2025-08', scoredAt: '2025-08-15T03:00:00.000Z', gpi: 68.2, reviewCount: 2062 },
	{ period: '2025-09', scoredAt: '2025-09-15T03:00:00.000Z', gpi: 67.7, reviewCount: 2157 },
	{ period: '2025-10', scoredAt: '2025-10-15T03:00:00.000Z', gpi: 66.7, reviewCount: 2208 },
	{ period: '2025-11', scoredAt: '2025-11-15T03:00:00.000Z', gpi: 66.7, reviewCount: 2221 },
	{ period: '2025-12', scoredAt: '2025-12-15T03:00:00.000Z', gpi: 66.7, reviewCount: 2223 },
	{ period: '2026-01', scoredAt: '2026-01-15T03:00:00.000Z', gpi: 66.5, reviewCount: 2225 },
	{ period: '2026-02', scoredAt: '2026-02-15T03:00:00.000Z', gpi: 66.4, reviewCount: 2231 },
	{ period: '2026-03', scoredAt: '2026-03-15T03:00:00.000Z', gpi: 66.5, reviewCount: 2232 },
	{ period: '2026-04', scoredAt: '2026-04-15T03:00:00.000Z', gpi: 67.9, reviewCount: 2312 },
	{ period: '2026-05', scoredAt: '2026-05-15T03:00:00.000Z', gpi: 67.3, reviewCount: 2362 },
	{ period: '2026-06', scoredAt: '2026-06-15T03:00:00.000Z', gpi: 67.1, reviewCount: 2466 }
];

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
