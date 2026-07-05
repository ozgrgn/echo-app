/**
 * login/+page.server.ts — server-side login that sets HttpOnly session cookies.
 *
 * Two form actions mirror the two-step flow:
 *   - credentials: validate {tenantKey, clientSecret} → login() → list owned venues.
 *       0 owned → error · 1 owned → set full session + redirect · N owned → set
 *       jwt+refresh now, return venues for the picker.
 *   - selectVenue: write the identity cookie for the chosen venue → redirect.
 *
 * All echo-api calls use the server base URL + request fetch (private network in
 * prod). Token/clientSecret never reach the browser — they live only in cookies.
 */

import { fail, redirect } from '@sveltejs/kit';
import { login, listVenues } from '@talkwo/echo-ui';
import { serverApiBaseUrl } from '$lib/server/apiBaseUrl';
import { setSession, setIdentityCookie, readRefresh, readJwt } from '$lib/server/session';
import type { Actions } from './$types';

function safeRedirectTarget(raw: string | null): string {
	// Only allow same-site absolute paths (no protocol-relative // or external).
	if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
	return '/dashboard';
}

export const actions: Actions = {
	credentials: async ({ request, fetch, cookies, url }) => {
		const form = await request.formData();
		const tenantKey = String(form.get('tenantKey') ?? '').trim();
		const clientSecret = String(form.get('clientSecret') ?? '').trim();
		const redirectTo = safeRedirectTarget(url.searchParams.get('redirectTo'));
		if (!tenantKey || !clientSecret) {
			return fail(400, { error: 'Tenant anahtarı ve client secret gerekli.', tenantKey });
		}

		const opts = { baseUrl: serverApiBaseUrl(), fetch };
		let token: string, expiresIn: number;
		try {
			const res = await login({ tenantKey, clientSecret }, opts);
			token = res.accessToken;
			expiresIn = res.expiresIn;
		} catch (e) {
			return fail(401, { error: e instanceof Error ? e.message : 'Giriş başarısız.', tenantKey });
		}

		const owned = (await listVenues(token, opts)).filter((v) => v.isOwned);
		if (owned.length === 0) {
			return fail(400, {
				error: "Tenant'ınıza otel kaydı yapılmamış. Talkwo ekibiyle iletişime geçin.",
				tenantKey
			});
		}

		if (owned.length === 1) {
			const v = owned[0];
			setSession(cookies, {
				token,
				expiresIn,
				refresh: { tenantKey, clientSecret },
				identity: { tenantKey, venueSlug: v.slug, venueName: v.name }
			});
			throw redirect(303, redirectTo);
		}

		// Multi-venue: persist jwt+refresh now (so selectVenue needs no re-login);
		// provisional identity = first venue (selectVenue overwrites it).
		const first = owned[0];
		setSession(cookies, {
			token,
			expiresIn,
			refresh: { tenantKey, clientSecret },
			identity: { tenantKey, venueSlug: first.slug, venueName: first.name }
		});
		return {
			step: 'venue-picker' as const,
			venues: owned.map((v) => ({ slug: v.slug, name: v.name, area: v.region?.area ?? '' }))
		};
	},

	selectVenue: async ({ request, cookies, url }) => {
		if (!readJwt(cookies) || !readRefresh(cookies)) {
			return fail(401, { error: 'Oturum süresi doldu, tekrar giriş yapın.' });
		}
		const form = await request.formData();
		const venueSlug = String(form.get('venueSlug') ?? '').trim();
		const venueName = String(form.get('venueName') ?? '').trim();
		if (!venueSlug) return fail(400, { error: 'Otel seçilmedi.' });

		const refresh = readRefresh(cookies)!;
		setIdentityCookie(cookies, { tenantKey: refresh.tenantKey, venueSlug, venueName });
		throw redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
