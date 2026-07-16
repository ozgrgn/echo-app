/**
 * lib/server/echoApi.ts — server-side echo-api binding with transparent 401 refresh.
 *
 * A +page.server.ts load builds one of these per request:
 *   const api = makeServerApi(event);
 *   const score = await api.getHotelScore(venueSlug, period);
 *
 * It binds three things every server call needs, so loads don't repeat them:
 *   - the internal base URL (locals.apiBaseUrl)
 *   - the request-scoped fetch (event.fetch)  — keeps SvelteKit request context
 *   - the current token (locals.session.token)
 *
 * 401 refresh (the tricky part): if a call 401s and we hold refresh creds, we
 * re-login server-side, REWRITE the echo_jwt cookie (needs event.cookies), and
 * retry ONCE. If refresh fails, redirect to /login + clear cookies. This
 * replaces the old in-memory clientSecret refresh from the client apiFetch.
 *
 * NOTE: the echo-ui fetchers vary in shape — some take FetchOpts as the last
 * param, others take a domain-`opts` object THEN a separate `fetchOpts`. This
 * wrapper hides that: each bound method calls the fetcher with the correct
 * argument order and injects `{ baseUrl, fetch }` in the right slot.
 */

import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import {
	login,
	loginDemo,
	getHotelScore,
	getCompetitorScores,
	getScoreHistory,
	getDailyHistory,
	getSegments,
	getImpact,
	getImpactConcentration,
	getDepartments,
	getDepartmentDetail,
	getDepartmentKeyTrend,
	getResponseStats,
	getResponseQueue,
	getReviews,
	getMentions,
	getPortfolioScore,
	getOsBundle,
	getVenueSettings,
	getVenueSettingsBundle,
	patchVenueSettings,
	getVenueGranularCatalog,
	patchVenueGranularRow,
	deleteVenueGranularRow,
	listAllVenues,
	listWatches,
	getHarvestRuns,
	type FetchOpts,
	type ReviewFilters,
	type MentionFilters,
	type VenueGranularPatch,
	type OsLens
} from '@talkwo/echo-ui';
import { setJwtCookie, clearSession, isDemoRefresh } from '$lib/server/session';

class Unauthenticated extends Error {}

export function makeServerApi(event: RequestEvent) {
	const { locals, fetch, cookies } = event;
	const baseUrl = locals.apiBaseUrl;

	// Mutable token: starts from the cookie, replaced in place after a refresh.
	let token = locals.session?.token ?? null;

	const fo = (): FetchOpts => ({ baseUrl, fetch });

	/**
	 * Re-auth after a 401. TWO paths, because a demo session has no password.
	 *
	 * A normal login stores {tenantKey, clientSecret} in the encrypted refresh cookie and
	 * re-logs-in with it. A demo session stores {demoToken} — the 30-day link token — and
	 * exchanges it for a fresh 1-hour staff JWT.
	 *
	 * WITHOUT THE DEMO BRANCH a presentation dies exactly one hour in: this function would
	 * call login() with an undefined clientSecret, the backend would 401, and the viewer
	 * would be bounced to /login mid-demo. The asymmetric lifetimes (long link, short JWT)
	 * are what make the demo survive a long session — but only if we come back here with
	 * the link token.
	 */
	async function refresh(): Promise<boolean> {
		if (!locals.refresh) return false;
		try {
			const res = isDemoRefresh(locals.refresh)
				? await loginDemo(locals.refresh.demoToken, fo())
				: await login(
						{ tenantKey: locals.refresh.tenantKey, clientSecret: locals.refresh.clientSecret },
						fo()
					);
			token = res.accessToken;
			setJwtCookie(cookies, res.accessToken, res.expiresIn);
			return true;
		} catch {
			return false;
		}
	}

	/** Run a bound fetcher; on 401, refresh once and retry, else redirect to /login. */
	async function withRetry<T>(run: (tok: string) => Promise<T>): Promise<T> {
		if (!token) throw new Unauthenticated();
		try {
			return await run(token);
		} catch (err) {
			const is401 = err instanceof Error && /\b401\b/.test(err.message);
			if (!is401) throw err;
			if (!(await refresh()) || !token) {
				clearSession(cookies);
				throw redirect(303, '/login');
			}
			return run(token);
		}
	}

	return {
		// ── simple shape: (..., token, FetchOpts) ──
		getHotelScore: (venueSlug: string, period: string | undefined, platform?: string, window?: string) =>
			withRetry((t) => getHotelScore(venueSlug, period, t, platform, window, fo())),
		getCompetitorScores: (venueSlug: string, period: string | undefined, window?: string, platform?: string) =>
			withRetry((t) => getCompetitorScores(venueSlug, period, t, window, platform, fo())),
		getSegments: (venueSlug: string, platform?: string, window?: string) =>
			withRetry((t) => getSegments(venueSlug, t, platform, window, fo())),
		getResponseStats: (venueSlug: string, platform?: string, window?: string) =>
			withRetry((t) => getResponseStats(venueSlug, t, platform, fo(), window)),
		getPortfolioScore: (period: string) => withRetry((t) => getPortfolioScore(period, t, fo())),
		// OS bundle: one call feeding a whole /os page (perf). 401-refresh comes free via withRetry.
		getOsBundle: (
			venueSlug: string,
			opts: { lens: OsLens; window?: string; period?: string; chartDaily?: boolean; chartFrom?: string }
		) => withRetry((t) => getOsBundle(venueSlug, t, opts, fo())),
		getVenueSettings: (venueSlug: string) => withRetry((t) => getVenueSettings(venueSlug, t, fo())),
		getVenueSettingsBundle: (venueSlug: string) =>
			withRetry((t) => getVenueSettingsBundle(venueSlug, t, fo())),
		getReviews: (venueSlug: string, filters: ReviewFilters) =>
			withRetry((t) => getReviews(venueSlug, filters, t, fo())),
		getMentions: (venueSlug: string, filters: MentionFilters = {}) =>
			withRetry((t) => getMentions(venueSlug, filters, t, fo())),
		patchVenueSettings: (venueSlug: string, patch: Parameters<typeof patchVenueSettings>[1]) =>
			withRetry((t) => patchVenueSettings(venueSlug, patch, t, fo())),
		getVenueGranularCatalog: (venueSlug: string) =>
			withRetry((t) => getVenueGranularCatalog(venueSlug, t, fo())),
		patchVenueGranularRow: (venueSlug: string, granularKey: string, patch: VenueGranularPatch) =>
			withRetry((t) => patchVenueGranularRow(venueSlug, granularKey, patch, t, fo())),
		deleteVenueGranularRow: (venueSlug: string, granularKey: string) =>
			withRetry((t) => deleteVenueGranularRow(venueSlug, granularKey, t, fo())),

		// ── domain-opts shape: (..., token, domainOpts, FetchOpts) ──
		getScoreHistory: (venueSlug: string, opts: { platform?: string; limit?: number; window?: string } = {}) =>
			withRetry((t) => getScoreHistory(venueSlug, t, opts, fo())),
		getDailyHistory: (
			venueSlug: string,
			opts: { platform?: string; from?: string; to?: string; window?: string; limit?: number } = {}
		) => withRetry((t) => getDailyHistory(venueSlug, t, opts, fo())),
		getImpact: (venueSlug: string, opts: { platform?: string; period?: string; target?: number; window?: string } = {}) =>
			withRetry((t) => getImpact(venueSlug, t, opts, fo())),
		getImpactConcentration: (venueSlug: string, category: string, opts: { window?: string } = {}) =>
			withRetry((t) => getImpactConcentration(venueSlug, category, t, opts, fo())),
		getDepartments: (venueSlug: string, opts: { platform?: string; period?: string; window?: string } = {}) =>
			withRetry((t) => getDepartments(venueSlug, t, opts, fo())),
		getDepartmentDetail: (
			venueSlug: string,
			deptKey: string,
			opts: { platform?: string; period?: string; window?: string } = {}
		) => withRetry((t) => getDepartmentDetail(venueSlug, deptKey, t, opts, fo())),
		getDepartmentKeyTrend: (
			venueSlug: string,
			deptKey: string,
			granularKey: string,
			opts: { platform?: string; window?: string } = {}
		) => withRetry((t) => getDepartmentKeyTrend(venueSlug, deptKey, granularKey, t, opts, fo())),
		getResponseQueue: (venueSlug: string, opts: { platform?: string; limit?: number } = {}) =>
			withRetry((t) => getResponseQueue(venueSlug, t, opts, fo())),

		// ── admin (superadmin surface) ──
		listAllVenues: () => withRetry((t) => listAllVenues(t, fo())),
		listWatches: (ownerVenueId?: string) => withRetry((t) => listWatches(t, ownerVenueId, fo())),
		getHarvestRuns: (days?: number) => withRetry((t) => getHarvestRuns(t, days, fo()))
	};
}

export type ServerApi = ReturnType<typeof makeServerApi>;
