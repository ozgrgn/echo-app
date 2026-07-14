import type { PageServerLoad } from './$types';
import type { ResponseStats } from '@talkwo/echo-ui';
import type { ResponseRateRow } from '$lib/mock/os';
import { MOCK_OS_RESPONSE } from '$lib/mock/os';
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

// SSR server load — ONE code path, always the real backend.
//
// This used to fork on `dataSource` (an `echo_os_source=mock` cookie set by the
// browser) and serve a hand-built DEMO_* dataset with no auth at all. Both the
// cookie and the demo constants are gone: the demo is now a real, backend-issued
// demo session (signed /demo?t=… link → fixture-served tenant), so it flows through
// this same loader. A demo user exercises the product, not a parallel mock that
// could drift from it.

export const load: PageServerLoad = async (event) => {
	const { url } = event;

	// ── ONE bundle call over the private network ─────────────────────────────
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
