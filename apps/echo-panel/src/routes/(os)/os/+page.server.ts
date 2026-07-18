import type { PageServerLoad } from './$types';
import type { ResponseStats } from '@talkwo/echo-ui';
import type { ResponseRateRow } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { listRadarGoals } from '$lib/server/radarApi';
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

	// ── Goal-driven hedef ────────────────────────────────────────────────────
	// The venue's radar GPI goal (Hedefler panel, reviews.gpi) drives BOTH the chart's
	// "Hedef" line and the impact lifts, via the bundle's ?impactTarget= — one number,
	// the one the owner actually committed to, instead of a hardcoded constant. Radar
	// unreachable / no goal set → undefined → the backend falls back to its constant.
	// Fetched BEFORE the bundle (the bundle needs the target); radar answers in well
	// under the bundle's own latency, and failure is swallowed (never blocks the page).
	let gpiGoalTarget: number | undefined;
	const tenantKey = event.locals.session?.tenantKey;
	if (tenantKey) {
		try {
			const goals = await listRadarGoals({ tenantKey, venueSlug }, event.fetch);
			const g = goals.find((r) => r.goal?.metricPath === 'reviews.gpi');
			if (g && Number.isFinite(g.goal.target)) gpiGoalTarget = g.goal.target;
		} catch {
			// radar yok/erişilemedi → sabit hedefe düş (sayfa asla bundan kırılmaz)
		}
	}

	// The OS bundle drives the whole page; the response-stats endpoint feeds ONLY the
	// "Yanıt Yönetimi" breakdown. Run them in parallel, but never let a response-stats
	// failure 404 the whole lens — the card renders its empty state instead. (It used
	// to degrade to a MOCK breakdown: a transient backend error would silently show a
	// real tenant fabricated per-platform numbers. Honest absence beats invented data.)
	const [bundleRes, responseStats] = await Promise.all([
		// A venue with no analyzed reviews yet (a freshly-onboarded owned tenant whose
		// harvest hasn't produced scores) makes getOsBundle 404. That's NOT an error to
		// crash the page on — the venue simply has no data yet. Catch it and fall through
		// to the empty state below, so the panel says "henüz veri yok" instead of a 500.
		api
			.getOsBundle(venueSlug, {
				lens: 'genel',
				window: w,
				period: requestPeriod,
				chartDaily: chart.daily,
				chartFrom: chart.from,
				impactTarget: gpiGoalTarget
			})
			.catch(() => null),
		// Same window as everything else on the page, so the card's rows and the
		// headline "%X" beside them count the same universe of reviews.
		api.getResponseStats(venueSlug, undefined, w).catch(() => null)
	]);

	// No bundle or no blended score → the venue has no analyzed reviews yet. Return a
	// noData flag (not a thrown error) so the page renders an honest empty state.
	if (!bundleRes || !bundleRes.blended) {
		return { noData: true, venueName: event.locals.session?.venueName ?? venueSlug, window };
	}
	const b = bundleRes;

	// Market benchmark = the REAL mean of the competitors' own response rates (their
	// snapshots carry responseStats, same can't-reply exclusions as our venue). It was
	// a hardcoded 0.69 mock shown to every tenant. No competitors → null → row hidden.
	const rivalRates = (b.competitors ?? [])
		.map((c) => c.responseRate)
		.filter((r): r is number => typeof r === 'number');
	const competitorAvgRate =
		rivalRates.length > 0 ? rivalRates.reduce((a, r) => a + r, 0) / rivalRates.length : null;

	const responseBreakdown = responseStats
		? { ...toResponseRows(responseStats), competitorAvgRate }
		: null;

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
