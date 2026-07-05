/**
 * lib/server/apiBaseUrl.ts — resolve the echo-api base URL for SERVER-side fetch.
 *
 * Resolution order:
 *   1. ECHO_API_INTERNAL_URL  — Railway private network (http://echo-api.railway.internal:PORT/v1).
 *      Server-to-server, no internet egress, no CORS. Unset in local dev.
 *   2. PUBLIC_ECHO_API_URL    — public echo-api. Used locally (no internal DNS) and as fallback.
 *      Skipped if it's the relative "/v1" (that only works for the browser via the Vite proxy;
 *      Node fetch on the server needs an absolute URL).
 *   3. hardcoded prod         — last-resort absolute URL.
 *
 * Always returns a URL that includes the /v1 prefix, with no trailing slash.
 */

import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

const PROD_FALLBACK = 'https://echo-api-production-b3a5.up.railway.app/v1';

function normalize(url: string): string {
	return url.replace(/\/$/, '');
}

/** Is this an absolute http(s) URL usable by Node fetch on the server? */
function isAbsolute(url: string | undefined): url is string {
	return !!url && /^https?:\/\//i.test(url);
}

export function serverApiBaseUrl(): string {
	const internal = privateEnv.ECHO_API_INTERNAL_URL;
	if (isAbsolute(internal)) return normalize(internal);

	const pub = publicEnv.PUBLIC_ECHO_API_URL;
	// A relative "/v1" (Vite dev proxy) is browser-only — the server needs absolute.
	if (isAbsolute(pub)) return normalize(pub);

	return PROD_FALLBACK;
}
