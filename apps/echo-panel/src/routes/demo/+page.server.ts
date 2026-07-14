/**
 * /demo?t=<linkToken> — the marketing tunnel's front door.
 *
 * Trades a signed demo LINK token for a real session, then drops the visitor into the
 * presentation hub. No OTP, no password: the link IS the credential, and it is a weak one
 * on purpose, because everything behind it is anonymised fixture data.
 *
 * What the visitor gets is an ORDINARY session cookie set — same shape as a customer's,
 * flagged isDemo. Every page then renders through the normal code path. That is the whole
 * design: no second "mock mode" to drift out of sync with the product.
 *
 * The backend is the one that verifies the token (it holds DEMO_TOKEN_SECRET) and mints a
 * demo-scoped staff JWT. We never inspect the token here — we hand it over and store what
 * comes back.
 *
 * The link token goes into the ENCRYPTED refresh cookie. It is long-lived (30 days) while
 * the staff JWT it buys lasts an hour; when the hour is up, echoApi.refresh() comes back
 * here with the link token and gets a fresh JWT. Without that, a presentation would drop
 * to /login exactly one hour in.
 */

import { redirect, error } from '@sveltejs/kit';
import { loginDemo } from '@talkwo/echo-ui';
import { setSession } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, fetch, locals }) => {
	const linkToken = url.searchParams.get('t');

	// Already inside a demo session and no new token → just go to the hub. Lets a viewer
	// bookmark /demo and come back without re-opening the emailed link.
	if (!linkToken && locals.session?.isDemo) {
		throw redirect(303, '/demo/hub');
	}

	if (!linkToken) {
		throw error(400, 'Demo bağlantısı geçersiz — bağlantıda erişim anahtarı yok.');
	}

	let res;
	try {
		res = await loginDemo(linkToken, { baseUrl: locals.apiBaseUrl, fetch });
	} catch (e) {
		// The backend answers 401 for a bad/expired link and 403 for a revoked one, but it
		// deliberately does not say which — and neither do we. What the viewer needs to know
		// is that this link will not work and who to ask.
		const detail = e instanceof Error ? e.message : '';
		throw error(
			403,
			`Bu demo bağlantısı artık geçerli değil (süresi dolmuş veya iptal edilmiş olabilir). ` +
				`Yeni bir bağlantı için ekibimizle iletişime geçin.${detail ? ` [${detail}]` : ''}`
		);
	}

	setSession(cookies, {
		token: res.accessToken,
		expiresIn: res.expiresIn,
		// The link token is the refresh credential — see the note above.
		refresh: { demoToken: linkToken },
		identity: {
			tenantKey: 'TEN_DEMO_AURELIA',
			venueSlug: res.venue.slug,
			venueName: res.venue.name,
			// A demo visitor is never a superadmin. The backend enforces this too (role
			// 'demo' fails isSuperadminStaff), so the UI flag is only about hiding buttons.
			isSuperadmin: false,
			isDemo: true
		}
	});

	// Strip the token from the URL — a bookmarked/screenshared /demo?t=… would otherwise
	// hand the credential to whoever sees it.
	throw redirect(303, '/demo/hub');
};
