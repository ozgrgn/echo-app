import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Region labels used to live here as a hand-written slug→town map, seeded with one
// customer's real rivals. Region is venue metadata: it belongs on the venue record
// the backend serves, not in a page loader. Until the backend carries it, the page
// simply doesn't show a region.

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	// No period → the backend returns the LATEST snapshot for the venue and each
	// competitor. This used to pin '2025-05', which 404'd every tenant without a
	// snapshot for that exact month.
	const [hotelScore, competitors] = await Promise.all([
		api.getHotelScore(session.venueSlug, undefined),
		api.getCompetitorScores(session.venueSlug, undefined)
	]);

	return {
		hotelScore,
		competitors,
		venueName: session.venueName ?? session.venueSlug
	};
};
