/**
 * (app)/+layout.server.ts — auth guard for the classic dashboard group.
 *
 * Unlike the OS group there is no mock carve-out here: every (app) page needs a
 * real session. No cookie session → redirect to /login (preserving target).
 * Exposes session identity as PageData for the pages/layout.
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.session) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	return {
		session: {
			tenantKey: locals.session.tenantKey,
			venueSlug: locals.session.venueSlug,
			venueName: locals.session.venueName
		}
	};
};
