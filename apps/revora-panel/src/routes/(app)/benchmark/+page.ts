import { getHotelScore, getCompetitorScores, MOCK_COMPETITOR_REGIONS } from '@revora/review-core';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
	const { token, venueSlug, venueName } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const period = '2025-05';
	const [hotelScore, competitors] = await Promise.all([
		getHotelScore(venueSlug, period, token),
		getCompetitorScores(venueSlug, period, token)
	]);

	// In Phase 2 the region join is server-side. Mock-only for now.
	const ownRegion =
		venueSlug === 'lago-hotel-sorgun'
			? 'Sorgun'
			: venueSlug === 'lago-hotel-belek'
				? 'Belek'
				: undefined;

	return {
		hotelScore,
		competitors,
		venueName: venueName ?? venueSlug,
		ownRegion,
		competitorRegions: MOCK_COMPETITOR_REGIONS
	};
}
