import { getHotelScore, getCompetitorScores } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

// Phase 1 mock: competitor → display region label.
// Phase 2: this comes from the backend venue metadata.
const COMPETITOR_REGIONS: Record<string, string> = {
	'crystal-sunset-luxury-resort-spa': 'Side',
	'rixos-premium-belek':              'Belek',
	'titanic-deluxe-belek':             'Belek',
	'barut-hemera':                     'Side',
	'voyage-sorgun':                    'Sorgun',
};

export async function load() {
	const { token, venueSlug, venueName } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const period = '2025-05';
	const [hotelScore, competitors] = await Promise.all([
		getHotelScore(venueSlug, period, token),
		getCompetitorScores(venueSlug, period, token)
	]);

	const ownRegion =
		venueSlug === 'lago-hotel-sorgun' ? 'Sorgun' :
		venueSlug === 'lago-hotel-belek'  ? 'Belek'  : undefined;

	return {
		hotelScore,
		competitors,
		venueName: venueName ?? venueSlug,
		ownRegion,
		competitorRegions: COMPETITOR_REGIONS
	};
}
