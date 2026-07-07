import type { PageServerLoad } from './$types';
import type { HistoryPoint } from '@talkwo/echo-ui';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES, DEMO_HISTORY } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam, windowChartMode } from '$lib/config/window';

// Platform OVERVIEW lens (SSR) — the /os/platform index. Compares all channels
// side by side: blended context + per-channel HotelScore + per-channel history.
// A specific channel is deep-linked from here into /os/platform/[platform].
//
//   • 'mock' → rich per-platform demo scores + synthetic per-platform history.
//   • 'live' → real per-channel snapshots + blended 'all', fanned out in parallel.
//
// This mirrors the Genel loader's channel fan-out but drops the Genel-only
// payload (segments/impact/competitors) — the overview is platform-scoped.

const CHANNELS = ['tripadvisor', 'booking', 'google', 'holidaycheck'] as const;

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const { dataSource } = await event.parent();

	// ── MOCK source ──
	if (dataSource === 'mock') {
		return {
			blended: DEMO_HOTEL_SCORE,
			period: DEMO_HOTEL_SCORE.period,
			channels: CHANNELS.map((p) => ({
				platform: p as string,
				score: DEMO_PLATFORM_SCORES[p] ?? DEMO_HOTEL_SCORE
			})),
			platformHistories: CHANNELS.map((p, i) => ({
				platform: p as string,
				points: (DEMO_HISTORY as HistoryPoint[]).map((h) => ({
					...h,
					gpi: +(h.gpi + (i - 1.5) * 2).toFixed(1)
				}))
			})),
			blendedHistory: DEMO_HISTORY as HistoryPoint[]
		};
	}

	// ── LIVE source ──
	const venueSlug = event.locals.session?.venueSlug;
	if (!venueSlug) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	// Window narrows the point-in-time scores (blended + per-channel) AND the chart's
	// range/resolution: wide → monthly series, narrow (6mo/3mo) → daily series clipped
	// to the window (see windowChartMode).
	const window = parseOsWindow(url.searchParams.get('window'));
	const w = windowParam(window);
	const chart = windowChartMode(window, new Date());

	// Monthly or daily trend fetch per the window's chart mode; both normalize to
	// { period, gpi }[] (daily uses asOfDate as the period).
	const fetchHistory = (platform: string) =>
		chart.daily
			? api
					.getDailyHistory(venueSlug, { platform, from: chart.from, window: chart.window, limit: 400 })
					.then((r) => r.points.map((p) => ({ period: p.asOfDate, scoredAt: p.scoredAt, gpi: p.gpi, reviewCount: p.reviewCount })))
					.catch(() => null)
			: api
					.getScoreHistory(venueSlug, { platform, limit: 24 })
					.then((r) => r.points)
					.catch(() => null);

	const [blended, blendedHistory, platformHistories, ...channelResults] = await Promise.all([
		api.getHotelScore(venueSlug, requestPeriod, undefined, w),
		// Blended 'all' history — the longest, canonical x-axis for the compare chart.
		fetchHistory('all'),
		// Per-channel history — a channel that lacks ≥2 points is dropped so we never
		// draw a flat one-point line (same filter the Genel compare chart uses).
		Promise.all(
			CHANNELS.map((p) =>
				fetchHistory(p).then((points) => (points ? { platform: p as string, points } : null))
			)
		).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null && r.points.length > 1)),
		// Per-channel snapshot — a channel with no snapshot yet drops out of the grid.
		...CHANNELS.map((p) =>
			api
				.getHotelScore(venueSlug, requestPeriod, p, w)
				.then((s) => ({ platform: p as string, score: s }))
				.catch(() => null)
		)
	]);

	const channels = channelResults.filter((c): c is NonNullable<typeof c> => c !== null);

	return { blended, period: blended.period, channels, platformHistories, blendedHistory, window, chartDaily: chart.daily };
};
