import type { PageServerLoad } from './$types';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam } from '$lib/config/window';

// Platform universe lens (SSR). Source decided by the layout server load.
//   • 'mock' → rich per-platform demo score.
//   • 'live' → real per-channel snapshot + blended 'all' for the hero comparison.

const KNOWN = ['tripadvisor', 'booking', 'google', 'holidaycheck'];

export const load: PageServerLoad = async (event) => {
	const { params, url } = event;
	const platform = params.platform;
	if (!KNOWN.includes(platform)) throw error(404, `Unknown platform: ${platform}`);

	const { dataSource } = await event.parent();

	// ── MOCK source ──
	if (dataSource === 'mock') {
		const platformScore = DEMO_PLATFORM_SCORES[platform] ?? DEMO_HOTEL_SCORE;
		return { platform, platformScore, blended: DEMO_HOTEL_SCORE, period: platformScore.period, history: null };
	}

	// ── LIVE source ──
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	// Window narrows the point-in-time scores (this channel + blended); history is
	// left full-range (time axis, not a scored-now figure).
	const window = parseOsWindow(url.searchParams.get('window'));
	const w = windowParam(window);

	const [platformScore, blended, history] = await Promise.all([
		api.getHotelScore(session.venueSlug, requestPeriod, platform, w),
		api.getHotelScore(session.venueSlug, requestPeriod, undefined, w), // blended 'all' for context
		api
			.getScoreHistory(session.venueSlug, { platform, limit: 24 })
			.then((r) => r.points)
			.catch(() => null)
	]);

	return { platform, platformScore, blended, period: platformScore.period, history, window };
};
