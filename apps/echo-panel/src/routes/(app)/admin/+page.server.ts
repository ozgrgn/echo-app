import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Superadmin venue/competitor/platform management (SSR).

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	// All venues including competitors (?include=competitors) + all watch relations.
	const [venues, watches] = await Promise.all([api.listAllVenues(), api.listWatches()]);
	return { venues, watches };
};
