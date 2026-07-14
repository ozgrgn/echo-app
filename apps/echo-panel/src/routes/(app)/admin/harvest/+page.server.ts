import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Harvest health/cost view (SSR). Superadmin ONLY — it exposes cross-tenant scrape
// volume and spend. The backend enforces this too (requireSuperadmin → 403), but we
// fail closed here as well so a non-superadmin never even renders the page shell.

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	if (!session.isSuperadmin) throw error(403, 'Bu sayfa yalnızca superadmin içindir.');

	const days = Number(event.url.searchParams.get('days') ?? 14);
	const api = makeServerApi(event);
	const report = await api.getHarvestRuns(Number.isFinite(days) ? days : 14);

	return { report };
};
