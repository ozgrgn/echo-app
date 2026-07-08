import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

/**
 * Owner Routing Settings — loads the venue's route catalog snapshot (created lazily
 * on first read by echo-backend). The page renders the editable per-row table.
 */
export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const catalog = await api.getVenueRoutingCatalog(session.venueSlug);

	return {
		venueName: session.venueName ?? session.venueSlug,
		venueSlug: session.venueSlug,
		catalog
	};
};
