import { getReviews } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ url }) => {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	// ?response=without is set by the Dashboard "Yanıtsız Yorum" KPI link.
	// Passing it to the backend ensures we get 200 matching reviews (not 200
	// random ones that might only have a handful without a response).
	// Other filters (platform, sentiment, lang, category) stay client-side for
	// now — Phase 3 will move them server-side with full cursor pagination.
	const responseParam = url.searchParams.get('response');
	const response =
		responseParam === 'with' || responseParam === 'without' ? responseParam : undefined;

	const { items, nextCursor } = await getReviews(
		venueSlug,
		{ limit: 200, ...(response ? { response } : {}) },
		token
	);

	// Derive available languages from the loaded set.
	const availableLanguages = [...new Set(items.map((r) => r.lang))].sort();

	return { reviews: items, nextCursor, availableLanguages };
};
