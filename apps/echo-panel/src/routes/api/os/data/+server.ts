/**
 * api/os/data/+server.ts — same-origin READ proxy for interactive OS fetches.
 *
 * A few OS pages fetch data at runtime (on tab/filter change), not just at load:
 * department detail, department list, per-platform response stats + queue. With
 * the JWT in an HttpOnly cookie the browser can't call echo-api directly, so it
 * calls here (?resource=…&venueSlug=…&…) and the server forwards over the private
 * network with locals.session.token.
 *
 * GET /api/os/data?resource=<name>&venueSlug=<slug>&...params
 *   resources: departments | departmentDetail | responseStats | responseQueue
 */

import { json, error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	if (!locals.session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const resource = url.searchParams.get('resource');
	const venueSlug = url.searchParams.get('venueSlug') ?? locals.session.venueSlug;
	const platform = url.searchParams.get('platform') ?? undefined;
	const period = url.searchParams.get('period') ?? undefined;
	const limitRaw = url.searchParams.get('limit');
	const limit = limitRaw ? Number(limitRaw) : undefined;

	try {
		switch (resource) {
			case 'departments':
				return json(await api.getDepartments(venueSlug, { platform, period }));
			case 'departmentDetail': {
				const deptKey = url.searchParams.get('deptKey');
				if (!deptKey) throw error(400, 'deptKey required');
				return json(await api.getDepartmentDetail(venueSlug, deptKey, { platform, period }));
			}
			case 'responseStats':
				return json(await api.getResponseStats(venueSlug, platform));
			case 'responseQueue':
				return json(await api.getResponseQueue(venueSlug, { platform, limit }));
			case 'mentions': {
				const polarity = url.searchParams.get('polarity') as 'negative' | 'positive' | null;
				const category = url.searchParams.get('category') ?? undefined;
				const subcategory = url.searchParams.get('subcategory') ?? undefined;
				return json(
					await api.getMentions(venueSlug, {
						limit,
						...(polarity ? { polarity } : {}),
						...(category ? { category } : {}),
						...(subcategory ? { subcategory } : {})
					})
				);
			}
			default:
				throw error(400, `Unknown resource: ${resource}`);
		}
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw SvelteKit errors/redirects
		const msg = e instanceof Error ? e.message : 'OS data fetch failed';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
