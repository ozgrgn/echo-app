import { filterMockReviews, mockAvailableLanguages } from '@revora/review-core';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	// Mock-only: load all reviews up-front for client-side filter.
	// In Phase 2 this becomes server-paginated via getReviews(...) with
	// cursor + filters in the URL.
	const reviews = filterMockReviews({});
	const availableLanguages = mockAvailableLanguages();

	return { reviews, availableLanguages };
}
