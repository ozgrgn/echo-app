/**
 * api/mention-override/+server.ts — same-origin write proxy for per-mention granular_key
 * corrections (fix ONE ABSA mislabel). Distinct from owner-routing (which reassigns a key's
 * DEPARTMENT globally); this corrects the granular_key of a single mention.
 *
 *   PATCH { reviewId, targetKey, orig_granular_key, new_granular_key } → correct one mention
 *
 * Venue always comes from the SESSION, never the body (IDOR guard). The browser never holds
 * the JWT; echo-backend independently re-checks superadmin + tenant scope. Takes effect on the
 * NEXT scoring tick (the correction is applied read-time, but the stored snapshot is rebuilt by
 * cron/rescore).
 */

import { json, error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');
	if (event.locals.session.isDemo) throw error(403, 'Demo oturumu salt-okunurdur.');

	let body: {
		reviewId?: string;
		targetKey?: string;
		orig_granular_key?: string;
		new_granular_key?: string;
	};
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.reviewId || !body.targetKey || !body.orig_granular_key || !body.new_granular_key) {
		throw error(400, 'Provide { reviewId, targetKey, orig_granular_key, new_granular_key }');
	}

	// Venue is bound to the session, NOT accepted from the caller.
	const venueSlug = event.locals.session.venueSlug;
	const api = makeServerApi(event);

	try {
		const res = await api.correctMention(venueSlug, {
			reviewId: body.reviewId,
			targetKey: body.targetKey,
			orig_granular_key: body.orig_granular_key,
			new_granular_key: body.new_granular_key
		});
		return json(res);
	} catch (e) {
		if (e instanceof Error) {
			const msg = e.message;
			const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
			throw error(m ? Number(m[1]) : 502, msg);
		}
		throw e;
	}
};
