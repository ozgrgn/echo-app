import { getHotelScore } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

export async function load() {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');
	const hotelScore = await getHotelScore(venueSlug, '2025-05', token);
	return { hotelScore };
}
