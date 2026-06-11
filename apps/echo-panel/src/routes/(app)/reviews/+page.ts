import { getReviews } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	// Fetch first 200 reviews up-front — client-side filters run on this slice.
	// Phase 3: move to server-paginated with cursor + URL-driven filters.
	const { items, nextCursor } = await getReviews(venueSlug, { limit: 200 }, token);

	// Derive available languages from the loaded set.
	const availableLanguages = [...new Set(items.map((r) => r.lang))].sort();

	return { reviews: items, nextCursor, availableLanguages };
}
