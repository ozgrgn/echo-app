/**
 * lib/mock/os.ts — the last few OS values the backend does NOT serve yet.
 *
 * This file used to be a demo dataset. It isn't any more: the mock data-source mode
 * (and the whole DEMO_* / KPI / trend / platform-list set that fed it) is gone —
 * demo tenants now get a real, backend-issued session over fixture data and read the
 * same live endpoints as everyone else.
 *
 * What's left is only what LIVE screens still need and no endpoint provides:
 *   • PLATFORM_COLOR / PLATFORM_PALETTE — presentation tokens (never had a backend)
 *   • MOCK_OS_COUNTERS — rail alert/goal badges           [MOCK→radar / MOCK→echo]
 *   • MOCK_OS_RESPONSE.competitorAvgRate — market benchmark          [MOCK→radar]
 *   • platformTrendFor / responseSliceFor — per-lens derivations     [MOCK→radar]
 *   • OsDept / ResponseRateRow / OsPlatform — types the real adapters map into
 *
 * Every remaining invented value keeps its `[MOCK→owner]` tag, so when the real
 * source lands we know exactly what to swap.
 */

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

// ── Department grid shape — the real GET /v1/departments/:slug rollup maps INTO
// this type (see toOsDept in the OS lenses). Scores/labels/trends are all real now.
export interface OsDept {
	key: string;          // ops canonical key: 'hk','mnt','fnb','fo'...
	label: string;        // [MOCK→ops]
	/** null = not enough mentions to score. Renders '—' (neutral), NEVER a red 0 —
	 *  an unscored department is unknown, not failing. */
	score: number | null;
	trend: 'up' | 'down' | 'flat'; // [MOCK→radar]
	/** Raw signed trend delta (period-over-period). Used to RANK the movement lists
	 *  (most-negative first) and to show the exact ± value — a threshold only bucketed
	 *  the direction and hid it. Optional so the mock set stays valid without it. */
	trendValue?: number;
	scope: string;        // human hint of covered categories
	enters: boolean;
	/** Mention count in the active window — lets a thin (unscored) card say
	 *  "veri az · N mention" instead of a bare "veri yok". Optional: mock rows omit it. */
	mentions?: number | null;
}

// MOCK_OS_DEPTS (eight invented department scores) is gone: the /os and
// /os/departments cards now read the real rollup from GET /v1/departments/:slug via
// /api/os/data?resource=departments, and show an empty state when it has nothing yet.
// The OsDept TYPE stays — it's the shape the real DepartmentScore is adapted into.


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

// ── Demo dataset — REMOVED ───────────────────────────────────────────────────
// DEMO_SEGMENTS / DEMO_HISTORY / DEMO_HOTEL_SCORE / DEMO_PLATFORM_SCORES /
// DEMO_COMPETITORS used to live here: a hand-built dataset (including real hotel
// names via echo-ui's MOCK_COMPETITORS) that the OS loaders returned whenever the
// client-writable `echo_os_source=mock` cookie was set — i.e. with no auth at all.
// Both the cookie and the dataset are gone. The demo is now a backend-issued demo
// session (signed /demo?t=… link) over fixture data, so it flows through the same
// live loaders as any customer and there is no second code path to keep in sync.
//
// What remains in this file is genuinely still in use in LIVE mode:
//   • PLATFORM_COLOR / PLATFORM_PALETTE — presentation tokens
//   • MOCK_OS_COUNTERS — rail alert/goal badges (no backend source yet)
//   • MOCK_OS_RESPONSE.competitorAvgRate — market response-rate benchmark [MOCK→radar]
//   • platformTrendFor / responseSliceFor — per-lens derivations [MOCK→radar]
//   • OsDept / ResponseRateRow — types used by real data adapters
