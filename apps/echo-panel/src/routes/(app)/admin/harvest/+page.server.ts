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

	// Name the failure instead of letting it surface as a bare 500. The most common
	// cause is a backend that predates this endpoint (404) — e.g. a dev server that
	// was already running before the route landed, or a panel deployed ahead of the
	// API. "Internal Error" sends you hunting; this tells you where to look.
	try {
		const report = await api.getHarvestRuns(Number.isFinite(days) ? days : 14);
		return { report };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('404')) {
			throw error(
				503,
				'echo-api bu uç noktayı tanımıyor (404). Backend, /v1/admin/harvest/runs ' +
					"rotasını içeren sürümden eski — API'yi yeniden başlatın/deploy edin."
			);
		}
		throw error(502, `Harvest raporu alınamadı: ${msg}`);
	}
};
