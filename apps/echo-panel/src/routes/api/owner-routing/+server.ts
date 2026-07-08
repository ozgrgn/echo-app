/**
 * api/owner-routing/+server.ts — same-origin write proxy for the Owner Routing table.
 *
 * PATCH { routeKey, patch }. The venue is taken from the SESSION, never the request
 * body — a client can't target another venue by sending a different slug (IDOR guard).
 * Reads locals.session.token and forwards to echo-api so the browser never holds the JWT.
 * (echo-backend independently re-checks superadmin + tenant scope.)
 */

import { json, error } from '@sveltejs/kit';
import type { VenueRoutePatch } from '@talkwo/echo-ui';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');

	let body: { routeKey?: string; patch?: VenueRoutePatch };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.routeKey || !body.patch) {
		throw error(400, 'routeKey and patch required');
	}

	// Venue is bound to the session, NOT accepted from the caller.
	const venueSlug = event.locals.session.venueSlug;

	const api = makeServerApi(event);
	try {
		const row = await api.patchVenueRoutingRow(venueSlug, body.routeKey, body.patch);
		return json({ ok: true, row });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Routing save failed';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
