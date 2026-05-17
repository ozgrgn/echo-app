import { listVenues, MOCK_COMPETITOR_REGIONS } from '@revora/review-core';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
	const { token, venueSlug, venueName, tenantKey, subscription } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const allVenues = await listVenues(token);
	const ownVenue = allVenues.find((v) => v.slug === venueSlug);
	const competitors = allVenues.filter((v) => !v.isOwned);

	return {
		ownVenue,
		competitors,
		venueName: venueName ?? venueSlug,
		tenantKey,
		subscription,
		competitorRegions: MOCK_COMPETITOR_REGIONS
	};
}
