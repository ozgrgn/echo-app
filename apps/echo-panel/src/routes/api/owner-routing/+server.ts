/**
 * api/owner-routing/+server.ts — same-origin write proxy for the Granular Owner config.
 *
 * (Path kept as /api/owner-routing so the page's fetch calls don't churn; the underlying
 * model is now the granular owner override — no routing mode.)
 *
 *   PATCH  { granularKey, patch: { owner_key?, enabled? } } → set a granular_key's override
 *   DELETE { granularKey }                                  → reset a key to catalog default
 *
 * Venue always comes from the SESSION, never the body (IDOR guard). Reads
 * locals.session.token and forwards to echo-api so the browser never holds the JWT.
 * (echo-backend independently re-checks superadmin + tenant scope.)
 */

import { json, error } from '@sveltejs/kit';
import type { VenueGranularPatch } from '@talkwo/echo-ui';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');
	// Demo sessions are read-only — see the note in api/venue-settings.
	if (event.locals.session.isDemo) throw error(403, 'Demo oturumu salt-okunurdur.');

	let body: { granularKey?: string; patch?: VenueGranularPatch };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.granularKey || !body.patch) {
		throw error(400, 'Provide { granularKey, patch }');
	}

	// Venue is bound to the session, NOT accepted from the caller.
	const venueSlug = event.locals.session.venueSlug;
	const api = makeServerApi(event);

	try {
		const row = await api.patchVenueGranularRow(venueSlug, body.granularKey, body.patch);
		return json({ ok: true, row });
	} catch (e) {
		if (e instanceof Error) {
			const msg = e.message;
			const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
			throw error(m ? Number(m[1]) : 502, msg);
		}
		throw e;
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');
	// Demo sessions are read-only — see the note in api/venue-settings.
	if (event.locals.session.isDemo) throw error(403, 'Demo oturumu salt-okunurdur.');

	let body: { granularKey?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.granularKey) throw error(400, 'Provide { granularKey }');

	const venueSlug = event.locals.session.venueSlug;
	const api = makeServerApi(event);

	try {
		const row = await api.deleteVenueGranularRow(venueSlug, body.granularKey);
		return json({ ok: true, row });
	} catch (e) {
		if (e instanceof Error) {
			const msg = e.message;
			const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
			throw error(m ? Number(m[1]) : 502, msg);
		}
		throw e;
	}
};
