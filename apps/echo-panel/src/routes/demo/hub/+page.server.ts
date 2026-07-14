/**
 * /demo/hub — the presentation hub. Only reachable inside a demo session.
 *
 * A real customer must not land here (it would show them a "sample data" framing of their
 * own live panel), so the guard is on isDemo, not merely on being logged in.
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.session) throw redirect(303, '/login');
	if (!locals.session.isDemo) throw redirect(303, '/os');

	return {
		venueName: locals.session.venueName
	};
};
