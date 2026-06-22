import type { PageLoad } from './$types';
import { getHotelScore, getScoreHistory } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { osDataSource } from '$lib/stores/osDataSource.svelte';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES } from '$lib/mock/os';
import { error } from '@sveltejs/kit';

// Platform universe lens. Source toggles at runtime (osDataSource):
//   • 'mock' → rich per-platform demo score.
//   • 'live' → real per-channel snapshot + blended 'all' for the hero comparison.
export const ssr = false;

const KNOWN = ['tripadvisor', 'booking', 'google', 'holidaycheck'];

export const load: PageLoad = async ({ params, url }) => {
	const platform = params.platform;
	if (!KNOWN.includes(platform)) throw error(404, `Unknown platform: ${platform}`);

	// ── MOCK source ──
	if (osDataSource.isMock) {
		const platformScore = DEMO_PLATFORM_SCORES[platform] ?? DEMO_HOTEL_SCORE;
		return { platform, platformScore, blended: DEMO_HOTEL_SCORE, period: platformScore.period, history: null };
	}

	// ── LIVE source ──
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '')
		? (paramPeriod as string)
		: undefined;

	const [platformScore, blended, history] = await Promise.all([
		getHotelScore(venueSlug, requestPeriod, token, platform),
		getHotelScore(venueSlug, requestPeriod, token), // blended 'all' for context
		// Real per-platform GPI series; best-effort so a miss doesn't break the lens.
		getScoreHistory(venueSlug, token, { platform, limit: 24 })
			.then((r) => r.points)
			.catch(() => null)
	]);

	return { platform, platformScore, blended, period: platformScore.period, history };
};
