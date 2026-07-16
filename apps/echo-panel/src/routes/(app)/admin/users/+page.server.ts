import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// ECHO Yönetim → Kullanıcılar: who may open ECHO (Staff.echo_access, managed in
// ops-engine; echo-backend proxies, stores nothing). Superadmin ONLY — it
// exposes cross-tenant staff PII. Backend enforces too (requireSuperadmin);
// we fail closed here so a non-superadmin never renders the page shell.
//
// The phone search lives in the URL (?phone=…) so it is SSR-rendered, survives
// reload, and every write can simply invalidateAll() to refresh the same view.

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	if (!session.isSuperadmin) throw error(403, 'Bu sayfa yalnızca superadmin içindir.');

	const phone = (event.url.searchParams.get('phone') ?? '').trim();
	const api = makeServerApi(event);

	try {
		const [users, venues] = await Promise.all([
			phone ? api.listEchoUsers(phone) : Promise.resolve([]),
			api.listEchoUserVenues()
		]);
		return { phone, users, venues };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('404')) {
			throw error(
				503,
				'echo-api bu uç noktayı tanımıyor (404). Backend, /v1/admin/users rotasını ' +
					"içeren sürümden eski — API'yi yeniden başlatın/deploy edin."
			);
		}
		throw error(502, `Kullanıcı verisi alınamadı: ${msg}`);
	}
};
