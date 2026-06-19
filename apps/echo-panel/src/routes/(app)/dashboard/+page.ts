import type { PageLoad } from './$types';
import { getHotelScore, getCompetitorScores } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

// Client-side load (auth is in-memory). Runs after auth guard in root layout.
export const ssr = false;

export const load: PageLoad = async ({ url }) => {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) {
		throw error(401, 'Not authenticated');
	}

	// Read ?period=YYYY-MM from URL.
	// If absent/invalid, pass undefined → backend returns the latest snapshot.
	// The actual period is read back from hotelScore.period (not assumed).
	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '')
		? (paramPeriod as string)
		: undefined;

	const [hotelScore, competitors] = await Promise.all([
		getHotelScore(venueSlug, requestPeriod, token),
		getCompetitorScores(venueSlug, requestPeriod, token)
	]);

	return { hotelScore, competitors, period: hotelScore.period };
};
