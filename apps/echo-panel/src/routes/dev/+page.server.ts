/**
 * dev/+page.server.ts — gate the component-showcase scaffold page.
 *
 * /dev sits outside the (app)/(os) layout groups, so it inherited NO auth guard and
 * shipped publicly. It leaks no tenant data (static components only), but an internal
 * scaffold page has no business being reachable in production.
 */
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!dev) throw error(404, 'Not found');
	return {};
};
