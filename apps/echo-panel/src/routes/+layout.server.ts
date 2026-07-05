/**
 * +layout.server.ts (root) — surface the cookie session to every page as PageData.
 *
 * hooks.server.ts parsed the cookies into locals.session. Here we expose the
 * NON-SENSITIVE identity (tenantKey/venueSlug/venueName — never the token) so the
 * client auth guard knows a valid cookie session exists even before the in-memory
 * `auth` store is populated (e.g. right after an SSR page load or a reload).
 * Fully-SSR pages read locals directly; this is the client-guard bridge.
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		session: locals.session
			? {
					tenantKey: locals.session.tenantKey,
					venueSlug: locals.session.venueSlug,
					venueName: locals.session.venueName
				}
			: null
	};
};
