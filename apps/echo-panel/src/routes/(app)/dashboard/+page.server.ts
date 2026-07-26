import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// SSR server load. Runs after the (app) auth guard in +layout.server.ts.

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	// The classic dashboard is an internal superadmin surface. Customers start in
	// ECHO OS and must not be able to reach this page by entering its URL directly.
	if (!session.isSuperadmin) throw redirect(303, '/os');
	const api = makeServerApi(event);

	// Read ?period=YYYY-MM from URL.
	// If absent/invalid, pass undefined → backend returns the latest snapshot.
	// The actual period is read back from hotelScore.period (not assumed).
	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '')
		? (paramPeriod as string)
		: undefined;

	const [hotelScore, competitors] = await Promise.all([
		api.getHotelScore(session.venueSlug, requestPeriod),
		api.getCompetitorScores(session.venueSlug, requestPeriod)
	]);

	return { hotelScore, competitors, period: hotelScore.period };
};
