import type { PageServerLoad } from './$types';
import { CATEGORY_LIST, type CategoryKey } from '@talkwo/echo-core';
import { filterMockReviews } from '@talkwo/echo-ui';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// All valid category keys — derived from CATEGORY_LIST so it stays in sync
// automatically when new categories are added.
const VALID_CATEGORIES: CategoryKey[] = CATEGORY_LIST.map(c => c.key);

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const upperKey = params.category.toUpperCase() as CategoryKey;
	if (!VALID_CATEGORIES.includes(upperKey)) {
		throw error(404, `Geçersiz kategori: ${params.category}`);
	}

	const hotelScore = await api.getHotelScore(session.venueSlug, '2025-05');
	const categoryScore = hotelScore.categoryScores.find((cs) => cs.category === upperKey);
	if (!categoryScore) {
		throw error(404, `Kategori verisi bulunamadı: ${upperKey}`);
	}

	// Mock-only: pull reviews mentioning this category
	const reviews = filterMockReviews({ category: upperKey });

	return { hotelScore, categoryScore, reviews, categoryKey: upperKey };
};
