/**
 * api/agenda/+server.ts — same-origin READ proxy for the right panel's radar data
 * (SAG_PANEL_FAZ1 §4, decision K1: panel → SvelteKit server → radar; the browser
 * never talks to radar). Twin of /api/os/data, but the upstream is talkwo-radar.
 *
 * GET /api/agenda?resource=<name>
 *   resources: alerts | goals | threads | all
 *
 * Scope comes from the SESSION, never from query params: the panel user may only
 * read their own venue's agenda, and radar re-enforces the same scope from the
 * minted token's claims (defense in both layers).
 */

import { json, error } from '@sveltejs/kit';
import { listRadarAlerts, listRadarGoals, listRadarThreads } from '$lib/server/radarApi';
import type { RadarScope, RadarAlertCard } from '$lib/server/radarApi';
import type { RequestHandler } from './$types';

/** ECHO panel is the REPUTATION lens of the shared radar store. PMS-domain cards
 * (occupancy dips, meter gaps…) belong to Atlas and must not even reach this
 * app's browser — filter server-side, not in the component. */
const reputationOnly = (cards: RadarAlertCard[]) =>
	cards.filter((c) => c.category === 'reputation');

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	if (!locals.session) throw error(401, 'Not authenticated');
	const scope: RadarScope = {
		tenantKey: locals.session.tenantKey,
		venueSlug: locals.session.venueSlug
	};

	const resource = url.searchParams.get('resource') ?? 'all';
	try {
		switch (resource) {
			case 'alerts':
				return json({ alerts: reputationOnly(await listRadarAlerts(scope, fetch)) });
			case 'goals':
				return json({ goals: await listRadarGoals(scope, fetch) });
			case 'threads':
				return json({ threads: await listRadarThreads(scope, fetch) });
			case 'all': {
				// One round-trip for the panel's initial paint. Sections fail SOFT and
				// independently: a radar hiccup on one surface must not blank the other
				// two, so each settles to [] and the panel renders what it has.
				const [alerts, goals, threads] = await Promise.allSettled([
					listRadarAlerts(scope, fetch),
					listRadarGoals(scope, fetch),
					listRadarThreads(scope, fetch)
				]);
				return json({
					alerts: alerts.status === 'fulfilled' ? reputationOnly(alerts.value) : [],
					goals: goals.status === 'fulfilled' ? goals.value : [],
					threads: threads.status === 'fulfilled' ? threads.value : [],
					partial:
						alerts.status === 'rejected' ||
						goals.status === 'rejected' ||
						threads.status === 'rejected'
				});
			}
			default:
				throw error(400, `Unknown resource: ${resource}`);
		}
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw SvelteKit errors
		const msg = e instanceof Error ? e.message : 'Agenda fetch failed';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
