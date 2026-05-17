import { getHotelScore, filterMockReviews, type CategoryKey } from '@revora/review-core';
import { auth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';

export const ssr = false;

const VALID_CATEGORIES: CategoryKey[] = [
	'FOOD', 'ROOM', 'STAFF', 'POOL', 'ANIM', 'FRONT', 'FACILITY', 'VALUE', 'SPA', 'GENERAL'
];

export async function load({ params }) {
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const upperKey = params.category.toUpperCase() as CategoryKey;
	if (!VALID_CATEGORIES.includes(upperKey)) {
		throw error(404, `Geçersiz kategori: ${params.category}`);
	}

	const hotelScore = await getHotelScore(venueSlug, '2025-05', token);
	const categoryScore = hotelScore.categoryScores.find((cs) => cs.category === upperKey);
	if (!categoryScore) {
		throw error(404, `Kategori verisi bulunamadı: ${upperKey}`);
	}

	// Mock-only: pull reviews mentioning this category
	const reviews = filterMockReviews({ category: upperKey });

	return { hotelScore, categoryScore, reviews, categoryKey: upperKey };
}
