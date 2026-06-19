import { listVenues, getVenueSettings } from '@talkwo/echo-ui';

// Phase 1 mock region labels — Phase 2: from backend venue metadata
const COMPETITOR_REGIONS: Record<string, string> = {
	'crystal-sunset-luxury-resort-spa': 'Side',
	'rixos-premium-belek':              'Belek',
	'titanic-deluxe-belek':             'Belek',
	'barut-hemera':                     'Side',
	'voyage-sorgun':                    'Sorgun',
};
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
	const { token, venueSlug, venueName, tenantKey, subscription } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const [allVenues, venueSettings] = await Promise.all([
		listVenues(token),
		getVenueSettings(venueSlug, token),
	]);

	const ownVenue = allVenues.find((v) => v.slug === venueSlug);
	const competitors = allVenues.filter((v) => !v.isOwned);

	return {
		ownVenue,
		competitors,
		venueName: venueName ?? venueSlug,
		tenantKey,
		subscription,
		competitorRegions: COMPETITOR_REGIONS,
		venueSettings,
	};
}
