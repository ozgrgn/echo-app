import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

/**
 * Granular Owner config — loads the venue's MERGED granular catalog (committed catalog ⊕
 * venue owner overrides) from echo-backend. The page renders the editable per-granular_key
 * table (owner + enabled; no routing mode).
 */
export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const catalog = await api.getVenueGranularCatalog(session.venueSlug);

	return {
		venueName: session.venueName ?? session.venueSlug,
		venueSlug: session.venueSlug,
		catalog
	};
};
