/**
 * (app)/+layout.server.ts — auth guard for the classic dashboard group.
 *
 * Every (app) page needs a real session. No cookie session → redirect to /login
 * (preserving target). Exposes session identity as PageData for the pages/layout.
 *
 * DEMO SESSIONS ARE SENT AWAY. Not because the demo lacks the data, but because two of
 * these pages (/categories, /benchmark) hard-code `period: '2025-05'` and 404 when that
 * snapshot is absent — which it is, in the demo fixtures. Rather than ship a demo that
 * dead-ends on a click, the demo is scoped to the OS lenses, which cover the same ground
 * (the OS platform view has both a review explorer and a response inbox). Lift this when
 * the hard-coded period is gone.
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.session) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	if (locals.session.isDemo) {
		throw redirect(303, '/demo/hub');
	}
	return {
		session: {
			tenantKey: locals.session.tenantKey,
			venueSlug: locals.session.venueSlug,
			venueName: locals.session.venueName,
			isSuperadmin: locals.session.isSuperadmin
		}
	};
};
