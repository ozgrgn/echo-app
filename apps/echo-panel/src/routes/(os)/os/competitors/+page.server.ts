import type { PageServerLoad } from './$types';
import { DEMO_HOTEL_SCORE, DEMO_COMPETITORS } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Competitors lens (SSR). Same data shape as (app)/benchmark, in OS lens style.
// Source decided by the layout server load (echo_os_source cookie).

// Phase 1 mock: competitor slug → display region label. Phase 2: backend metadata. [MOCK→radar]
const COMPETITOR_REGIONS: Record<string, string> = {
	'crystal-sunset-luxury-resort-spa': 'Side',
	'rixos-premium-belek': 'Belek',
	'titanic-deluxe-belek': 'Belek',
	'barut-hemera': 'Side',
	'voyage-sorgun': 'Sorgun'
};

function ownRegionFor(slug: string): string | undefined {
	if (slug === 'lago-hotel-sorgun') return 'Sorgun';
	if (slug === 'lago-hotel-belek') return 'Belek';
	return undefined;
}

export const load: PageServerLoad = async (event) => {
	const { dataSource } = await event.parent();

	// ── MOCK source ──────────────────────────────────────────────────────────
	if (dataSource === 'mock') {
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			venueName: DEMO_HOTEL_SCORE.venueName,
			ownRegion: ownRegionFor(DEMO_HOTEL_SCORE.venueSlug),
			competitorRegions: COMPETITOR_REGIONS
		};
	}

	// ── LIVE source ──────────────────────────────────────────────────────────
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const [hotelScore, competitors] = await Promise.all([
		api.getHotelScore(session.venueSlug, undefined),
		api.getCompetitorScores(session.venueSlug, undefined)
	]);

	return {
		hotelScore,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		ownRegion: ownRegionFor(session.venueSlug),
		competitorRegions: COMPETITOR_REGIONS
	};
};
