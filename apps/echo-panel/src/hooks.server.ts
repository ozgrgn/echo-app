/**
 * hooks.server.ts — populate event.locals from session cookies on every request.
 *
 * Runs before any load/endpoint. Reads the HttpOnly session cookies and exposes:
 *   - locals.session   : {token, tenantKey, venueSlug, venueName} or null
 *   - locals.refresh   : {tenantKey, clientSecret} or null (for 401 re-auth)
 *   - locals.apiBaseUrl: internal echo-api URL (prod) / public (dev)
 *
 * No route guarding here — redirects live in the group +layout.server.ts loads,
 * where the mock-OS carve-out is also expressed (one place for auth policy).
 */

import type { Handle } from '@sveltejs/kit';
import { readJwt, readIdentity, readRefresh } from '$lib/server/session';
import { serverApiBaseUrl } from '$lib/server/apiBaseUrl';

export const handle: Handle = async ({ event, resolve }) => {
	const token = readJwt(event.cookies);
	const identity = readIdentity(event.cookies);

	event.locals.session = token && identity ? { token, ...identity } : null;
	event.locals.refresh = readRefresh(event.cookies);
	event.locals.apiBaseUrl = serverApiBaseUrl();

	return resolve(event);
};
