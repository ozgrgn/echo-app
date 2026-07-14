/**
 * (os)/os/+layout.server.ts — auth guard for the OS lenses.
 *
 * There used to be a carve-out here: an `echo_os_source=mock` cookie let the request
 * through with NO auth, so the OS pages would render a demo dataset server-side. The
 * cookie was written by client-side JS and was not HttpOnly — anyone could set it from
 * the console and read the OS surface without logging in. It is gone.
 *
 * The demo it existed for is now a real, revocable thing: a signed link (/demo?t=…) buys
 * a demo-scoped, read-only session from the backend, and the OS pages render it through
 * the SAME code path as a customer's — because it IS a session. One branch, not two, so
 * the demo exercises the product rather than a parallel mock that can drift from it.
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.session) {
		// Bounce to login, preserving the intended target.
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	return {
		session: {
			tenantKey: locals.session.tenantKey,
			venueSlug: locals.session.venueSlug,
			venueName: locals.session.venueName,
			isSuperadmin: locals.session.isSuperadmin,
			isDemo: locals.session.isDemo ?? false
		}
	};
};
