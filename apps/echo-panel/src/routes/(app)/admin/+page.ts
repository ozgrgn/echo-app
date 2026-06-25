import type { PageLoad } from './$types';
import { listAllVenues, listWatches } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

// Superadmin venue/competitor/platform management. Client-side load (auth in-memory).
export const ssr = false;

export const load: PageLoad = async () => {
	const { token } = auth;
	if (!token) throw error(401, 'Not authenticated');

	// All venues including competitors (?include=competitors) + all watch relations.
	const [venues, watches] = await Promise.all([listAllVenues(token), listWatches(token)]);
	return { venues, watches };
};
