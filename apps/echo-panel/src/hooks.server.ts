/**
 * hooks.server.ts — populate event.locals from session cookies on every request.
 *
 * Runs before any load/endpoint. Reads the HttpOnly session cookies and exposes:
 *   - locals.session   : {token, tenantKey, venueSlug, venueName, isSuperadmin, isDemo} or null
 *   - locals.refresh   : {tenantKey, clientSecret} | {demoToken} or null (for 401 re-auth)
 *   - locals.apiBaseUrl: internal echo-api URL (prod) / public (dev)
 *
 * A demo visitor (entered via /demo?t=…) has a NORMAL session here — same shape, same
 * cookies, flagged isDemo. That is deliberate: the panel has one auth path, and the demo
 * walks it, so the demo exercises the product rather than a parallel mock. What makes it
 * a demo is the tenant it is scoped to (fixture-served, read-only, enforced backend-side).
 *
 * No route guarding here — redirects live in the group +layout.server.ts loads (one place
 * for auth policy).
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
