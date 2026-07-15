import type { PageServerLoad } from './$types';
import { CATEGORY_LIST, type CategoryKey, type Review } from '@talkwo/echo-core';
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

	// No period → the backend returns the venue's LATEST snapshot (was pinned to
	// '2025-05', which 404'd every tenant without a snapshot for that exact month).
	const hotelScore = await api.getHotelScore(session.venueSlug, undefined);
	const categoryScore = hotelScore.categoryScores.find((cs) => cs.category === upperKey);
	if (!categoryScore) {
		throw error(404, `Kategori verisi bulunamadı: ${upperKey}`);
	}

	// Review feed: EMPTY until wired to the real reviews API. It used to serve
	// filterMockReviews() — fabricated reviews rendered to real tenants as if they
	// were the hotel's own. The page's empty state ("yorum bulunamadı") is honest;
	// category-scoped browsing lives in the OS mention explorer meanwhile.
	const reviews: Review[] = [];
	return { hotelScore, categoryScore, reviews, categoryKey: upperKey };
};
