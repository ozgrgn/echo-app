/**
 * api/owner-routing/+server.ts — same-origin write proxy for the Owner Routing table.
 *
 * PATCH { venueSlug, routeKey, patch }. Reads locals.session.token and forwards to
 * echo-api over the private network, so the browser never holds the JWT.
 */

import { json, error } from '@sveltejs/kit';
import type { VenueRoutePatch } from '@talkwo/echo-ui';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');

	let body: { venueSlug?: string; routeKey?: string; patch?: VenueRoutePatch };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.venueSlug || !body.routeKey || !body.patch) {
		throw error(400, 'venueSlug, routeKey and patch required');
	}

	const api = makeServerApi(event);
	try {
		const row = await api.patchVenueRoutingRow(body.venueSlug, body.routeKey, body.patch);
		return json({ ok: true, row });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Routing save failed';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
