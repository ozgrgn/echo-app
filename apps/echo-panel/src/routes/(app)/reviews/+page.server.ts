import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	// ?response=without is set by the Dashboard "Yanıtsız Yorum" KPI link.
	// Passing it to the backend ensures we get 200 matching reviews (not 200
	// random ones that might only have a handful without a response).
	// Other filters (platform, sentiment, lang, category) stay client-side for
	// now — Phase 3 will move them server-side with full cursor pagination.
	const responseParam = url.searchParams.get('response');
	const response =
		responseParam === 'with' || responseParam === 'without' ? responseParam : undefined;

	const { items, nextCursor } = await api.getReviews(session.venueSlug, {
		limit: 200,
		...(response ? { response } : {})
	});

	// Derive available languages from the loaded set.
	const availableLanguages = [...new Set(items.map((r) => r.lang))].sort();

	return { reviews: items, nextCursor, availableLanguages };
};
