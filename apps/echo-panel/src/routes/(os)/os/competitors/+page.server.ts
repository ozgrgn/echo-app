import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Competitors lens (SSR). Same data shape as (app)/benchmark, in OS lens style.
//
// Everything here is LIVE. The page used to have three mock affordances, all now gone:
//   - a whole-page mock branch (echo_os_source cookie) — that bypass is removed
//   - an empty-list fallback to MOCK_COMPETITORS (real hotels: Rixos, Titanic, Barut…)
//   - a "DEMO" badge to mark the rows the fallback had injected
// The badge only existed to paper over the fallback. With the fallback gone, an empty
// competitor list renders as an empty state that says so — which is the honest signal
// ("this tenant has no scored rivals") the fallback was hiding.
//
// Region labels are likewise gone: they were a hard-coded slug→town map for one
// customer's rivals. Region belongs in venue metadata, not in a page loader.

// Time-window selector: ?window=3mo shortens the scoring horizon so a recovering
// venue's current standing is visible (backend scores each window separately).
// Absent/invalid → '24mo' (full-history default, matches pre-window behaviour).
const WINDOWS = ['24mo', '12mo', '6mo', '3mo'] as const;
type Window = (typeof WINDOWS)[number];
function parseWindow(raw: string | null): Window {
	return WINDOWS.includes(raw as Window) ? (raw as Window) : '24mo';
}

export const load: PageServerLoad = async (event) => {
	const window = parseWindow(event.url.searchParams.get('window'));

	// ONE bundle call. This lens was the worst offender — ~10 calls in TWO serial waves
	// (the platformCompare fan-out awaited the first pair). The backend now does both
	// server-side (platformCompare included). lens='competitors' skips
	// histories/segments/impact (no over-fetch).
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

	// platformCompare comes ready from the bundle (own+rivals per channel, filtered to
	// channels with a score). ownVenueName falls back to session if the score lacked one.
	const platformCompare =
		b.platformCompare && b.platformCompare.platforms.length > 0
			? {
					...b.platformCompare,
					ownVenueName:
						b.platformCompare.ownVenueName || (session.venueName ?? session.venueSlug)
				}
			: null;

	return {
		hotelScore: b.blended,
		competitors: b.competitors, // empty means empty — the UI shows an empty state
		venueName: session.venueName ?? session.venueSlug,
		window,
		platformCompare
	};
};
