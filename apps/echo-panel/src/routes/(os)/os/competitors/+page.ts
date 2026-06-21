import type { PageLoad } from './$types';
import { getHotelScore, getCompetitorScores } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { osDataSource } from '$lib/stores/osDataSource.svelte';
import { DEMO_HOTEL_SCORE, DEMO_COMPETITORS } from '$lib/mock/os';
import { error } from '@sveltejs/kit';

// Competitors lens. Same data shape as the (app)/benchmark page, but rendered in
// the OS lens style. Source toggles at runtime (osDataSource):
//   • 'mock' → rich demo dataset.
//   • 'live' → blended hotel score + competitor scores from the real backend.
export const ssr = false;

// Phase 1 mock: competitor slug → display region label.
// Phase 2: this comes from backend venue metadata. [MOCK→radar]
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

export const load: PageLoad = async () => {
	// ── MOCK source ──────────────────────────────────────────────────────────
	if (osDataSource.isMock) {
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			venueName: DEMO_HOTEL_SCORE.venueName,
			ownRegion: ownRegionFor(DEMO_HOTEL_SCORE.venueSlug),
			competitorRegions: COMPETITOR_REGIONS
		};
	}

	// ── LIVE source ──────────────────────────────────────────────────────────
	const { token, venueSlug, venueName } = auth;
	if (!token || !venueSlug) throw error(401, 'Not authenticated');

	const [hotelScore, competitors] = await Promise.all([
		getHotelScore(venueSlug, undefined, token),
		getCompetitorScores(venueSlug, undefined, token)
	]);

	return {
		hotelScore,
		competitors,
		venueName: venueName ?? venueSlug,
		ownRegion: ownRegionFor(venueSlug),
		competitorRegions: COMPETITOR_REGIONS
	};
};
