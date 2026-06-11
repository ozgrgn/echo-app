import { getHotelScore, getCompetitorScores } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

// Client-side load (auth is in-memory). Runs after auth guard in root layout.
export const ssr = false;

export async function load() {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) {
		throw error(401, 'Not authenticated');
	}

	// Mock mode ignores period; Phase 2 will pull from a period store.
	const period = '2025-05';

	const [hotelScore, competitors] = await Promise.all([
		getHotelScore(venueSlug, period, token),
		getCompetitorScores(venueSlug, period, token)
	]);

	return { hotelScore, competitors, period };
}
