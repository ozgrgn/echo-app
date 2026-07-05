/**
 * (os)/os/+layout.server.ts — auth guard + mock carve-out for the OS lenses.
 *
 * Policy in one place:
 *   - MOCK mode (echo_os_source cookie === 'mock'): let the request through with
 *     NO auth — the OS lenses render the rich demo dataset server-side. Preserves
 *     the "presentation survives a reload / direct URL" behavior, now under SSR.
 *   - LIVE mode: require a cookie session; otherwise redirect to /login.
 *
 * Exposes `dataSource` + `session` as PageData so the +page.server.ts loads and
 * the client know which branch rendered without re-reading the cookie.
 */

import { redirect } from '@sveltejs/kit';
import { OS_SOURCE_COOKIE } from '$lib/stores/osDataSource.svelte';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies, url }) => {
	const isMock = cookies.get(OS_SOURCE_COOKIE) === 'mock';

	if (!isMock && !locals.session) {
		// Live OS needs a session; bounce to login, preserving intended target.
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	return {
		dataSource: isMock ? ('mock' as const) : ('live' as const),
		session: locals.session
			? {
					tenantKey: locals.session.tenantKey,
					venueSlug: locals.session.venueSlug,
					venueName: locals.session.venueName
				}
			: null
	};
};
