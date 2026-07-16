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
import {
	listRadarAlerts,
	listRadarGoals,
	listRadarThreads,
	setRadarGoal,
	previewRadarGoal,
	deleteRadarGoal,
	muteRadarAlert,
	getRadarMetricSeries
} from '$lib/server/radarApi';
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
			case 'series': {
				// Alert-detail chart. Same path discipline as the goal whitelist's spirit:
				// reviews.* only — radar enforces it again on its side.
				const path = url.searchParams.get('path') ?? '';
				if (!/^reviews\.[a-zA-Z0-9_.]{1,80}$/.test(path)) throw error(400, 'Geçersiz metrik yolu');
				const days = Math.min(Number(url.searchParams.get('days')) || 365, 730);
				return json(await getRadarMetricSeries(scope, path, days, fetch));
			}
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

/** Goal-able metricPath whitelist (SAG_PANEL_FAZ1 EK B). Everything the form can
 * produce and NOTHING else — granular key scores stay alert-only (EK B #8), and a
 * crafted path must not reach radar through this proxy. Mirrors radar's
 * metric-catalog reviews entries. */
const GOALABLE_PATHS = [
	/^reviews\.(gpi|rpi|responseRate|avgStarRating)$/,
	/^reviews\.departments\.[a-z][a-z0-9_]{1,23}\.gpi$/,
	/^reviews\.platforms\.(booking|tripadvisor|google|holidaycheck|check24)\.(rating|gpi)$/
];

// POST /api/agenda — body { action: 'setGoal' | 'previewGoal', metricPath, target, label?, deadline? }
// previewGoal is the confirm-modal dry-run: same validation, nothing persisted.
export const POST: RequestHandler = async ({ request, locals, fetch }) => {
	if (!locals.session) throw error(401, 'Not authenticated');
	const scope: RadarScope = {
		tenantKey: locals.session.tenantKey,
		venueSlug: locals.session.venueSlug
	};

	const body = await request.json().catch(() => null);
	const action = body?.action;
	if (!body || !['setGoal', 'previewGoal', 'deleteGoal', 'muteAlert'].includes(action))
		throw error(400, 'Unknown action');

	if (action === 'muteAlert') {
		const fingerprint = String(body.fingerprint ?? '');
		const preset = String(body.preset ?? '');
		if (!fingerprint) throw error(400, 'fingerprint required');
		if (!['7d', '30d', 'forever'].includes(preset)) throw error(400, 'preset: 7d | 30d | forever');
		try {
			return json(await muteRadarAlert(scope, fingerprint, preset as '7d' | '30d' | 'forever', fetch));
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Uyarı susturulamadı';
			const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
			throw error(m ? Number(m[1]) : 502, msg);
		}
	}

	if (action === 'deleteGoal') {
		const goalId = String(body.goalId ?? '');
		if (!goalId) throw error(400, 'goalId required');
		try {
			return json(await deleteRadarGoal(scope, goalId, fetch));
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Hedef silinemedi';
			const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
			throw error(m ? Number(m[1]) : 502, msg);
		}
	}

	const metricPath = String(body.metricPath ?? '');
	if (!GOALABLE_PATHS.some((re) => re.test(metricPath))) {
		throw error(400, `Bu metriğe hedef konamaz: ${metricPath}`);
	}
	const target = Number(body.target);
	if (!Number.isFinite(target)) throw error(400, 'Hedef değeri sayı olmalı');
	const label = body.label ? String(body.label).slice(0, 60) : undefined;
	const deadline = body.deadline ? String(body.deadline) : undefined;
	if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
		throw error(400, 'Son tarih YYYY-AA-GG biçiminde olmalı');
	}

	try {
		const call = body.action === 'previewGoal' ? previewRadarGoal : setRadarGoal;
		const report = await call(scope, { metricPath, target, label, deadline }, fetch);
		return json(report);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Hedef kaydedilemedi';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
