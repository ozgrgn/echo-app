import type { PageServerLoad } from './$types';
import type { SegmentsResponse, HistoryPoint, ImpactResponse, ResponseStats } from '@talkwo/echo-ui';
import type { ResponseRateRow } from '$lib/mock/os';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES, DEMO_COMPETITORS, DEMO_SEGMENTS, DEMO_HISTORY, MOCK_OS_RESPONSE } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam, windowChartMode } from '$lib/config/window';

// Human labels for the response breakdown (backend slices carry a raw platform key).
const PLATFORM_LABEL: Record<string, string> = {
	google: 'Google',
	tripadvisor: 'TripAdvisor',
	booking: 'Booking',
	holidaycheck: 'HolidayCheck'
};
const SENTIMENT_LABEL: Record<string, string> = {
	negative: 'Olumsuz',
	neutral: 'Nötr',
	positive: 'Olumlu'
};

/** Map the backend's ResponseStats into the ResponseRateRow shape the card renders.
 *  Backend byPlatform slices carry `platform`; bySentiment carry a `key` — normalize
 *  both to {key,label,rate,responded,total}. */
function toResponseRows(stats: ResponseStats): {
	byPlatform: ResponseRateRow[];
	bySentiment: ResponseRateRow[];
} {
	const byPlatform = (stats.byPlatform ?? []).map((p) => ({
		key: p.platform,
		label: PLATFORM_LABEL[p.platform] ?? p.platform,
		rate: p.rate,
		responded: p.responded,
		total: p.total
	}));
	const bySentiment = (stats.bySentiment ?? []).map((s) => ({
		key: s.key,
		label: SENTIMENT_LABEL[s.key] ?? s.key,
		rate: s.rate,
		responded: s.responded,
		total: s.total
	}));
	return { byPlatform, bySentiment };
}

// SSR server load. Source is decided by the layout server load (echo_os_source
// cookie): 'mock' → rich demo dataset (no auth); 'live' → real backend over the
// private network (locals session token + request fetch).

const CHANNELS = ['tripadvisor', 'booking', 'google', 'holidaycheck'] as const;

// Demo impact for mock mode: derive a plausible leverage list from the demo
// hotel's category scores. Real mode uses the backend's counterfactual GPI math.
function demoImpact(): ImpactResponse {
	const target = 85;
	const cats = (DEMO_HOTEL_SCORE.categoryScores ?? [])
		.filter((c) => c.aspectScore != null)
		.map((c) => {
			const score = c.aspectScore as number;
			const lift = Math.max(0, ((target - score) / 100) * Math.log10(c.mentionCount + 1) * 3);
			return {
				category: c.category,
				label: c.category,
				aspectScore: Math.round(score * 10) / 10,
				mentionCount: c.mentionCount,
				liftToTarget: Math.round(lift * 10) / 10,
				dragFromTop: Math.round((score - target) * 10) / 10
			};
		})
		.sort((a, b) => b.liftToTarget - a.liftToTarget);
	return { gpi: DEMO_HOTEL_SCORE.gpi, target, categories: cats, underMeasured: [] };
}

export const load: PageServerLoad = async (event) => {
	const { url, parent } = event;
	const { dataSource } = await parent();

	// ── MOCK source: rich demo data, no auth/backend needed ──────────────────
	if (dataSource === 'mock') {
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			channels: CHANNELS.map((p) => ({ platform: p, score: DEMO_PLATFORM_SCORES[p] })),
			period: DEMO_HOTEL_SCORE.period,
			segments: DEMO_SEGMENTS as SegmentsResponse,
			history: DEMO_HISTORY as HistoryPoint[],
			platformHistories: CHANNELS.map((p, i) => ({
				platform: p as string,
				points: (DEMO_HISTORY as HistoryPoint[]).map((h) => ({ ...h, gpi: +(h.gpi + (i - 1.5) * 2).toFixed(1) }))
			})),
			impact: demoImpact(),
			// Demo response breakdown — the mock constants (already in ResponseRateRow shape).
			responseBreakdown: {
				byPlatform: MOCK_OS_RESPONSE.byPlatform,
				bySentiment: MOCK_OS_RESPONSE.bySentiment,
				competitorAvgRate: MOCK_OS_RESPONSE.competitorAvgRate
			}
		};
	}

	// ── LIVE source: ONE bundle call over the private network ────────────────
	// Perf: this whole lens used to make ~12 separate HTTP calls (11 parallel + 1
	// serial getImpact). The backend now fans them out server-side; we make ONE
	// round-trip. The window→chart decision stays here (windowChartMode) and is
	// passed to the bundle so the monthly-vs-daily series logic lives in one place.
	const venueSlug = event.locals.session?.venueSlug;
	if (!venueSlug) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	const window = parseOsWindow(url.searchParams.get('window'));
	const w = windowParam(window);
	const chart = windowChartMode(window, new Date());

	// The OS bundle drives the whole page; the response-stats endpoint feeds ONLY the
	// "Yanıt Yönetimi" breakdown. Run them in parallel, but never let a response-stats
	// failure 404 the whole lens — the card degrades to the mock breakdown instead.
	const [b, responseStats] = await Promise.all([
		api.getOsBundle(venueSlug, {
			lens: 'genel',
			window: w,
			period: requestPeriod,
			chartDaily: chart.daily,
			chartFrom: chart.from
		}),
		api.getResponseStats(venueSlug).catch(() => null)
	]);

	// The bundle 404s when there's no snapshot, so a 200 always carries a blended
	// score. Narrow the type (and guard the edge case) before handing it to the page.
	if (!b.blended) throw error(404, 'No score snapshot for this venue');

	// Real per-platform / per-sentiment response rates (replaces the old mock). The
	// competitor/market average is not served yet → keep the mock benchmark for now.
	const responseBreakdown = responseStats
		? { ...toResponseRows(responseStats), competitorAvgRate: MOCK_OS_RESPONSE.competitorAvgRate }
		: {
				byPlatform: MOCK_OS_RESPONSE.byPlatform,
				bySentiment: MOCK_OS_RESPONSE.bySentiment,
				competitorAvgRate: MOCK_OS_RESPONSE.competitorAvgRate
			};

	return {
		hotelScore: b.blended,
		competitors: b.competitors,
		channels: b.channels,
		period: b.period ?? b.blended?.period,
		segments: b.segments,
		history: b.blendedHistory,
		platformHistories: b.platformHistories,
		impact: b.impact,
		responseBreakdown,
		window,
		chartDaily: chart.daily
	};
};
