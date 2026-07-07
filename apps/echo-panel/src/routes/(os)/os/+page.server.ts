import type { PageServerLoad } from './$types';
import type { SegmentsResponse, HistoryPoint, ImpactResponse } from '@talkwo/echo-ui';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES, DEMO_COMPETITORS, DEMO_SEGMENTS, DEMO_HISTORY } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam, windowChartMode } from '$lib/config/window';

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
			impact: demoImpact()
		};
	}

	// ── LIVE source: real backend over the private network ───────────────────
	const venueSlug = event.locals.session?.venueSlug;
	if (!venueSlug) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	// Global time-window: a lookback horizon applied to the POINT-IN-TIME figures
	// (own score, competitors, segments, impact, per-platform scores) AND to the
	// trend chart's range/resolution — wide windows show the monthly series, narrow
	// ones (6mo/3mo) switch to the DAILY series clipped to the window so the chart
	// zooms in at day resolution instead of showing 3–6 sparse month points.
	const window = parseOsWindow(url.searchParams.get('window'));
	const w = windowParam(window);
	const chart = windowChartMode(window, new Date());

	// A trend fetch for one platform, monthly or daily per the window's chart mode.
	// Both normalize to { period, gpi }[] (daily uses asOfDate as the period).
	const fetchHistory = (platform: string) =>
		chart.daily
			? api
					.getDailyHistory(venueSlug, { platform, from: chart.from, window: chart.window, limit: 400 })
					.then((r) => r.points.map((p) => ({ period: p.asOfDate, scoredAt: p.scoredAt, gpi: p.gpi, reviewCount: p.reviewCount, newReviews: 0 })))
					.catch(() => null)
			: api
					.getScoreHistory(venueSlug, { platform, limit: 24, window: w })
					.then((r) => r.points)
					.catch(() => null);

	const [hotelScore, competitors, segments, history, platformHistories, ...channelResults] =
		await Promise.all([
			api.getHotelScore(venueSlug, requestPeriod, undefined, w),
			api.getCompetitorScores(venueSlug, requestPeriod, w),
			// Best-effort: a failure must not break the whole lens.
			api.getSegments(venueSlug, undefined, w).catch(() => null),
			fetchHistory('all'),
			Promise.all(
				CHANNELS.map((p) =>
					fetchHistory(p).then((points) => (points ? { platform: p as string, points } : null))
				)
			).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null && r.points.length > 1)),
			...CHANNELS.map((p) =>
				api
					.getHotelScore(venueSlug, requestPeriod, p, w)
					.then((s) => ({ platform: p, score: s }))
					.catch(() => null)
			)
		]);

	const channels = channelResults.filter((c): c is NonNullable<typeof c> => c !== null);

	const impact = await api
		.getImpact(venueSlug, { ...(requestPeriod ? { period: requestPeriod } : {}), ...(w ? { window: w } : {}) })
		.catch(() => null);

	return { hotelScore, competitors, channels, period: hotelScore.period, segments, history, platformHistories, impact, window, chartDaily: chart.daily };
};
