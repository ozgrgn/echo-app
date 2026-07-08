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

// Platform comparison channels. The top-level GPI bars + heatmap always show the
// blended overall (no active-channel tab anymore); these four channels are pivoted
// side-by-side in the "Platform Bazlı Karşılaştırma" section instead. Labels match
// the backend whitelist (scores/read.ts ?platform=).
const COMPARE_PLATFORMS = [
	{ key: 'tripadvisor', label: 'TripAdvisor' },
	{ key: 'google', label: 'Google' },
	{ key: 'booking', label: 'Booking' },
	{ key: 'holidaycheck', label: 'HolidayCheck' }
] as const;

export const load: PageServerLoad = async (event) => {
	const { dataSource } = await event.parent();
	const window = parseWindow(event.url.searchParams.get('window'));

	// ── MOCK source ──────────────────────────────────────────────────────────
	// Demo data is a single fixed snapshot — the window selector still renders but every
	// value returns the same mock numbers (no per-window mock set), and the platform
	// comparison is null (real-only). Live source is where the figures actually change.
	if (dataSource === 'mock') {
		// Whole page is demo → own hotel AND every competitor are mock.
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			venueName: DEMO_HOTEL_SCORE.venueName,
			ownRegion: ownRegionFor(DEMO_HOTEL_SCORE.venueSlug),
			competitorRegions: COMPETITOR_REGIONS,
			window,
			// Platform comparison is REAL-only (each channel's live snapshot); demo mode
			// shows the "canlıda gelir" placeholder rather than fabricated per-channel bars.
			platformCompare: null,
			pageIsMock: true,
			mockSlugs: DEMO_COMPETITORS.map((c) => c.venueSlug)
		};
	}

	// ── LIVE source: ONE bundle call ──────────────────────────────────────────
	// Perf: this lens was the worst offender — ~10 calls in TWO serial waves (the
	// platformCompare fan-out awaited the first pair). The backend now does both
	// server-side (platformCompare included); we make ONE round-trip. lens=
	// 'competitors' skips histories/segments/impact (no over-fetch).
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	// window is this file's local '24mo'|'12mo'|'6mo'|'3mo'; send undefined at the
	// default so the URL/param stays clean at 24mo (matches windowParam elsewhere).
	const b = await api.getOsBundle(session.venueSlug, {
		lens: 'competitors',
		window: window === '24mo' ? undefined : window
	});

	// The bundle 404s without a snapshot, so a 200 always carries blended.
	if (!b.blended) throw error(404, 'No score snapshot for this venue');

	// Empty-competitor fallback: the old getCompetitorScores fetcher substituted the
	// demo set when the live blended list was empty, so a competitor-less tenant never
	// looked broken. The bundle does NOT do this (it returns the raw []), so re-apply
	// it here — ONLY for the blended list, matching the old fetcher's behaviour.
	const competitors = b.competitors.length > 0 ? b.competitors : MOCK_COMPETITORS;

	// platformCompare comes ready from the bundle (own+rivals per channel, filtered to
	// channels with a score). ownVenueName falls back to session if the score lacked one.
	const platformCompare =
		b.platformCompare && b.platformCompare.platforms.length > 0
			? { ...b.platformCompare, ownVenueName: b.platformCompare.ownVenueName || (session.venueName ?? session.venueSlug) }
			: null;

	// Live own-venue data is always real. Competitors CAN still be mock (the fallback
	// above, or a rival slug that is itself a demo placeholder) — badge them.
	const mockSlugs = competitors.filter((c) => MOCK_COMPETITOR_SLUGS.has(c.venueSlug)).map((c) => c.venueSlug);

	return {
		hotelScore: b.blended,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		ownRegion: ownRegionFor(session.venueSlug),
		competitorRegions: COMPETITOR_REGIONS,
		window,
		platformCompare,
		pageIsMock: false,
		mockSlugs
	};
};
