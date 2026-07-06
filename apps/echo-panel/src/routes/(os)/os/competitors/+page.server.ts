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

// Time-window selector: ?window=3mo shortens the scoring horizon so a recovering
// venue's current standing is visible (backend scores each window separately).
// Absent/invalid → '24mo' (full-history default, matches pre-window behaviour).
const WINDOWS = ['24mo', '12mo', '6mo', '3mo'] as const;
type Window = (typeof WINDOWS)[number];
function parseWindow(raw: string | null): Window {
	return WINDOWS.includes(raw as Window) ? (raw as Window) : '24mo';
}

export const load: PageServerLoad = async (event) => {
	const { dataSource } = await event.parent();
	const window = parseWindow(event.url.searchParams.get('window'));

	// ── MOCK source ──────────────────────────────────────────────────────────
	// Demo data is a single fixed snapshot — the window tabs still render and are
	// selectable, but every window returns the same mock numbers (no per-window
	// mock set). Live source is where the tabs actually change the figures.
	if (dataSource === 'mock') {
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			venueName: DEMO_HOTEL_SCORE.venueName,
			ownRegion: ownRegionFor(DEMO_HOTEL_SCORE.venueSlug),
			competitorRegions: COMPETITOR_REGIONS,
			window
		};
	}

	// ── LIVE source ──────────────────────────────────────────────────────────
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const [hotelScore, competitors] = await Promise.all([
		api.getHotelScore(session.venueSlug, undefined, undefined, window),
		api.getCompetitorScores(session.venueSlug, undefined, window)
	]);

	return {
		hotelScore,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		ownRegion: ownRegionFor(session.venueSlug),
		competitorRegions: COMPETITOR_REGIONS,
		window
	};
};
