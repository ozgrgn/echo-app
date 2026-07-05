/**
 * login/session/+server.ts — write the HttpOnly session cookies after a
 * client-side login (transitional bridge for the incremental SSR migration).
 *
 * During the migration the login page still authenticates client-side and fills
 * the in-memory `auth` store (so not-yet-SSR pages keep working). It ALSO POSTs
 * the token + creds + identity here so the server can set the session cookies —
 * which the now-SSR pages read. Once every page is SSR (Phase C), the login page
 * will move fully server-side and this endpoint + the client store token go away.
 *
 * Same-origin POST; the JSON body carries the token the client already holds, so
 * no secret is newly exposed to the network beyond what login() already returned.
 */

import { json, error } from '@sveltejs/kit';
import { setSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: {
		token?: string;
		expiresIn?: number;
		tenantKey?: string;
		clientSecret?: string;
		venueSlug?: string;
		venueName?: string;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { token, expiresIn, tenantKey, clientSecret, venueSlug, venueName } = body;
	if (!token || !expiresIn || !tenantKey || !clientSecret || !venueSlug) {
		throw error(400, 'Missing session fields');
	}

	setSession(cookies, {
		token,
		expiresIn,
		refresh: { tenantKey, clientSecret },
		identity: { tenantKey, venueSlug, venueName: venueName ?? venueSlug }
	});

	return json({ ok: true });
};
