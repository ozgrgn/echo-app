import type { PageServerLoad } from './$types';
import { DEMO_HOTEL_SCORE, DEMO_COMPETITORS } from '$lib/mock/os';
import { MOCK_COMPETITORS } from '@talkwo/echo-ui';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Competitors lens (SSR). Same data shape as (app)/benchmark, in OS lens style.
// Source decided by the layout server load (echo_os_source cookie).

// Slugs that are demo data, NOT real scored competitors. Two mock sources feed this
// page: DEMO_COMPETITORS (whole-page mock mode) and MOCK_COMPETITORS (the api.ts
// fallback when the live competitor endpoint returns an empty list). We mark any row
// whose slug is in either set so the UI can badge it "demo" — otherwise users can't
// tell a placeholder rival from a real one (which caused real confusion in practice).
const MOCK_COMPETITOR_SLUGS = new Set<string>([
	...DEMO_COMPETITORS.map((c) => c.venueSlug),
	...MOCK_COMPETITORS.map((c) => c.venueSlug)
]);

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
		// Whole page is demo → own hotel AND every competitor are mock.
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			venueName: DEMO_HOTEL_SCORE.venueName,
			ownRegion: ownRegionFor(DEMO_HOTEL_SCORE.venueSlug),
			competitorRegions: COMPETITOR_REGIONS,
			window,
			pageIsMock: true,
			mockSlugs: DEMO_COMPETITORS.map((c) => c.venueSlug)
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

	// Live own-venue data is always real. Competitors CAN still be mock: getCompetitorScores
	// falls back to MOCK_COMPETITORS when the live endpoint returns an empty list. Flag each
	// competitor whose slug is a known mock slug so the UI badges only those rows as "demo".
	const mockSlugs = competitors.filter((c) => MOCK_COMPETITOR_SLUGS.has(c.venueSlug)).map((c) => c.venueSlug);

	return {
		hotelScore,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		ownRegion: ownRegionFor(session.venueSlug),
		competitorRegions: COMPETITOR_REGIONS,
		window,
		pageIsMock: false,
		mockSlugs
	};
};
