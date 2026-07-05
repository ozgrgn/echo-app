import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Phase 1 mock: competitor → display region label.
// Phase 2: this comes from the backend venue metadata.
const COMPETITOR_REGIONS: Record<string, string> = {
	'crystal-sunset-luxury-resort-spa': 'Side',
	'rixos-premium-belek':              'Belek',
	'titanic-deluxe-belek':             'Belek',
	'barut-hemera':                     'Side',
	'voyage-sorgun':                    'Sorgun',
};

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const period = '2025-05';
	const [hotelScore, competitors] = await Promise.all([
		api.getHotelScore(session.venueSlug, period),
		api.getCompetitorScores(session.venueSlug, period)
	]);

	const ownRegion =
		session.venueSlug === 'lago-hotel-sorgun' ? 'Sorgun' :
		session.venueSlug === 'lago-hotel-belek'  ? 'Belek'  : undefined;

	return {
		hotelScore,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		ownRegion,
		competitorRegions: COMPETITOR_REGIONS
	};
};
