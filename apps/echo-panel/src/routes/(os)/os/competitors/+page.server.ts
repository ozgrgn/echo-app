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

// Platform lens: ?platform=tripadvisor compares rivals on ONE channel's snapshot.
// 'all' (default) = the blended overall comparison. The four channels match the
// backend whitelist; anything else falls back to 'all'.
const PLATFORMS = ['all', 'tripadvisor', 'google', 'booking', 'holidaycheck'] as const;
type Platform = (typeof PLATFORMS)[number];
function parsePlatform(raw: string | null): Platform {
	return PLATFORMS.includes(raw as Platform) ? (raw as Platform) : 'all';
}

export const load: PageServerLoad = async (event) => {
	const { dataSource } = await event.parent();
	const window = parseWindow(event.url.searchParams.get('window'));
	const platform = parsePlatform(event.url.searchParams.get('platform'));

	// ── MOCK source ──────────────────────────────────────────────────────────
	// Demo data is a single fixed snapshot — the window/platform tabs still render
	// and are selectable, but every combination returns the same mock numbers (no
	// per-window/per-platform mock set). Live source is where the tabs change figures.
	if (dataSource === 'mock') {
		// Whole page is demo → own hotel AND every competitor are mock.
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			venueName: DEMO_HOTEL_SCORE.venueName,
			ownRegion: ownRegionFor(DEMO_HOTEL_SCORE.venueSlug),
			competitorRegions: COMPETITOR_REGIONS,
			window,
			platform,
			ownOnPlatform: true,
			// Department comparison is REAL-only (rolled up from live snapshots); demo mode
			// shows the "canlıda gelir" placeholder rather than a fabricated rollup.
			deptCompare: null,
			pageIsMock: true,
			mockSlugs: DEMO_COMPETITORS.map((c) => c.venueSlug)
		};
	}

	// ── LIVE source ──────────────────────────────────────────────────────────
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	// All three follow the same platform+window lens. Department compare is best-effort
	// (a channel with thin data may 404 the own snapshot) — null it rather than fail the
	// whole page, so the GPI/heatmap sections still render.
	//
	// Own score under a platform filter can 404 if the venue lacks a snapshot on that
	// channel; fall back to the blended own score so the page still renders (competitors
	// are still compared on the selected channel). `ownOnPlatform=false` lets the UI note
	// the own row is blended while rivals are channel-specific — rare for a real venue.
	const platformArg = platform === 'all' ? undefined : platform;
	const [ownPlatformScore, competitors, deptCompare] = await Promise.all([
		api.getHotelScore(session.venueSlug, undefined, platformArg, window).catch(() => null),
		api.getCompetitorScores(session.venueSlug, undefined, window, platform),
		api.getDepartmentsCompare(session.venueSlug, { platform, window }).catch(() => null)
	]);
	const ownOnPlatform = ownPlatformScore !== null;
	const hotelScore = ownPlatformScore ?? (await api.getHotelScore(session.venueSlug, undefined, undefined, window));

	// Live own-venue data is always real. Competitors CAN still be mock: getCompetitorScores
	// falls back to MOCK_COMPETITORS when the live endpoint returns an empty list (blended
	// only — under a platform filter an empty list passes through). Flag known mock slugs.
	const mockSlugs = competitors.filter((c) => MOCK_COMPETITOR_SLUGS.has(c.venueSlug)).map((c) => c.venueSlug);

	return {
		hotelScore,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		ownRegion: ownRegionFor(session.venueSlug),
		competitorRegions: COMPETITOR_REGIONS,
		window,
		platform,
		ownOnPlatform,
		deptCompare,
		pageIsMock: false,
		mockSlugs
	};
};
