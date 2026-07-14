import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam, windowChartMode } from '$lib/config/window';

// Platform universe lens (SSR). Always live: the real per-channel snapshot plus the
// blended 'all' score for the hero comparison. The former mock branch (a demo score
// picked by a client-writable cookie) is gone — demo sessions are real sessions now.

const KNOWN = ['tripadvisor', 'booking', 'google', 'holidaycheck'];

export const load: PageServerLoad = async (event) => {
	const { params, url } = event;
	const platform = params.platform;
	if (!KNOWN.includes(platform)) throw error(404, `Unknown platform: ${platform}`);

	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	// Window narrows the point-in-time scores (this channel + blended) AND the chart:
	// wide → monthly, narrow → daily clipped to the window.
	const window = parseOsWindow(url.searchParams.get('window'));
	const w = windowParam(window);
	const chart = windowChartMode(window, new Date());

	const historyFetch = chart.daily
		? api
				.getDailyHistory(session.venueSlug, { platform, from: chart.from, window: chart.window, limit: 400 })
				.then((r) => r.points.map((p) => ({ period: p.asOfDate, scoredAt: p.scoredAt, gpi: p.gpi, reviewCount: p.reviewCount })))
				.catch(() => null)
		: api
				.getScoreHistory(session.venueSlug, { platform, limit: 24, window: w })
				.then((r) => r.points)
				.catch(() => null);

	const [platformScore, blended, history] = await Promise.all([
		api.getHotelScore(session.venueSlug, requestPeriod, platform, w),
		api.getHotelScore(session.venueSlug, requestPeriod, undefined, w), // blended 'all' for context
		historyFetch
	]);

	return { platform, platformScore, blended, period: platformScore.period, history, window, chartDaily: chart.daily };
};
