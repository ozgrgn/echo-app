import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);
	// No period → the backend returns the venue's LATEST snapshot. This used to pin
	// '2025-05', which 404'd every tenant without a snapshot for that exact month.
	const hotelScore = await api.getHotelScore(session.venueSlug, undefined);
	return { hotelScore };
};
