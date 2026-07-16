/**
 * login/+page.server.ts — server-side login that sets HttpOnly session cookies.
 *
 * PRIMARY flow — OTP (user-based, ops-engine delegated via echo-backend broker):
 *   - otpRequest:     phone → POST /v1/auth/request-otp (SMS goes out) → code step.
 *   - otpVerify:      phone+code → POST /v1/auth/verify-otp → selection token +
 *       echo venue options. 1 venue → select immediately, set session, redirect.
 *       N venues → stash the selection token in a short-lived HttpOnly cookie,
 *       return the picker.
 *   - otpSelectVenue: choice → POST /v1/auth/select-venue (Bearer selection
 *       token from the cookie) → 24h venue-scoped session token → cookies set.
 *   OTP sessions store {otpSession:true} as refresh creds — a marker, not a
 *   credential: no silent re-auth; after 24h the user walks /login again.
 *
 * LEGACY flow (clientSecret, kept during the OTP transition — panelAuth is
 * slated for removal): credentials + selectVenue actions, unchanged.
 *
 * All echo-api calls use the server base URL + request fetch (private network in
 * prod). Tokens/secrets never reach the browser — they live only in cookies.
 */

import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
	login,
	listVenues,
	whoami,
	requestOtp,
	verifyOtp,
	otpSelectVenue,
	ApiProblemError,
	type EchoVenueOption
} from '@talkwo/echo-ui';
import { serverApiBaseUrl } from '$lib/server/apiBaseUrl';
import {
	setSession,
	setIdentityCookie,
	readRefresh,
	readJwt,
	readIdentity
} from '$lib/server/session';
import type { Cookies } from '@sveltejs/kit';
import type { Actions } from './$types';

function safeRedirectTarget(raw: string | null): string {
	// Only allow same-site absolute paths (no protocol-relative // or external).
	if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
	return '/dashboard';
}

// ── OTP helpers ───────────────────────────────────────────────────────────────

/** Selection token parked between verify-otp and select-venue (multi-venue only).
 *  HttpOnly + 30m (the token's own TTL) — it is a bearer credential for exactly
 *  one endpoint, so it never reaches browser JS. */
const OTP_SELECTION_COOKIE = 'echo_otp_selection';

function setSelectionCookie(cookies: Cookies, token: string): void {
	cookies.set(OTP_SELECTION_COOKIE, token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/login',
		maxAge: 30 * 60
	});
}

/** Turkish UX messages keyed by the backend's machine-readable problem codes. */
function otpErrorMessage(e: unknown): string {
	if (e instanceof ApiProblemError) {
		switch (e.code) {
			case 'STAFF_NOT_FOUND':
				return 'Bu telefon numarasına kayıtlı kullanıcı bulunamadı.';
			case 'OTP_RATE_LIMITED':
				return `Çok sık kod istendi — ${e.retryAfter ?? 60} saniye sonra tekrar deneyin.`;
			case 'OTP_INVALID':
				return 'Kod hatalı. Tekrar deneyin.';
			case 'OTP_EXPIRED':
				return 'Kodun süresi doldu. Yeni kod isteyin.';
			case 'OTP_MAX_ATTEMPTS':
				return 'Çok fazla yanlış deneme. Yeni kod isteyin.';
			case 'OTP_NOT_REQUESTED':
				return 'Önce kod isteyin.';
			case 'NO_ECHO_ACCESS':
				return 'Bu hesabın ECHO erişimi yok. Talkwo ekibiyle iletişime geçin.';
			case 'VENUE_NOT_ALLOWED':
				return 'Bu otel için erişiminiz yok.';
			case 'INVALID_SELECTION_TOKEN':
			case 'NOT_A_SELECTION_TOKEN':
				return 'Oturum adımı zaman aşımına uğradı — baştan giriş yapın.';
			case 'OTP_NOT_CONFIGURED':
				return 'OTP girişi bu sunucuda yapılandırılmamış.';
			default:
				return e.message || 'İşlem başarısız.';
		}
	}
	return e instanceof Error ? e.message : 'İşlem başarısız.';
}

/** Normalize a Turkish mobile to the stored '90XXXXXXXXXX' shape. */
function normalizePhone(raw: string): string {
	const digits = raw.replace(/[^\d]/g, '').replace(/^0+/, '');
	return digits.startsWith('90') ? digits : `90${digits}`;
}

/** Finish an OTP login: exchange choice → session token, resolve authority, set cookies. */
async function completeOtpSession(args: {
	cookies: Cookies;
	fetchFn: typeof fetch;
	selectionToken: string;
	choice: { tenantKey: string; venueSlug: string };
	redirectTo: string;
}): Promise<never> {
	const opts = { baseUrl: serverApiBaseUrl(), fetch: args.fetchFn };
	const session = await otpSelectVenue(args.selectionToken, args.choice, opts);

	// Authority comes from whoami on the SESSION token (single source of truth —
	// superadmin OTP sessions carry role 'superadmin'); degrade to false on failure.
	let isSuperadmin = false;
	try {
		isSuperadmin = (await whoami(session.accessToken, opts)).isSuperadmin;
	} catch {
		isSuperadmin = false;
	}

	setSession(args.cookies, {
		token: session.accessToken,
		expiresIn: session.expiresIn,
		refresh: { otpSession: true },
		identity: {
			tenantKey: session.venue.tenantKey,
			venueSlug: session.venue.venueSlug,
			venueName: session.venue.venueName ?? '',
			isSuperadmin
		}
	});
	args.cookies.delete(OTP_SELECTION_COOKIE, { path: '/login' });
	throw redirect(303, args.redirectTo);
}

export const actions: Actions = {
	// ── OTP flow (primary) ──────────────────────────────────────────────────────

	otpRequest: async ({ request, fetch, }) => {
		const form = await request.formData();
		const rawPhone = String(form.get('phone') ?? '').trim();
		if (!rawPhone) return fail(400, { step: 'otp-phone' as const, error: 'Telefon numarası gerekli.' });
		const phone = normalizePhone(rawPhone);

		try {
			const res = await requestOtp({ phone }, { baseUrl: serverApiBaseUrl(), fetch });
			return {
				step: 'otp-code' as const,
				phone,
				expiresIn: res.expires_in ?? 300,
				// dev/OTP_BYPASS convenience — backend only sends this outside prod.
				devOtp: res.dev_otp ?? null
			};
		} catch (e) {
			return fail(e instanceof ApiProblemError ? e.status : 500, {
				step: 'otp-phone' as const,
				phone: rawPhone,
				error: otpErrorMessage(e)
			});
		}
	},

	otpVerify: async ({ request, fetch, cookies, url }) => {
		const form = await request.formData();
		const phone = normalizePhone(String(form.get('phone') ?? '').trim());
		const otp = String(form.get('otp') ?? '').trim();
		const redirectTo = safeRedirectTarget(url.searchParams.get('redirectTo'));
		if (!phone || !otp) {
			return fail(400, { step: 'otp-code' as const, phone, error: 'Kod gerekli.' });
		}

		let verified: Awaited<ReturnType<typeof verifyOtp>>;
		try {
			verified = await verifyOtp({ phone, otp }, { baseUrl: serverApiBaseUrl(), fetch });
		} catch (e) {
			return fail(e instanceof ApiProblemError ? e.status : 500, {
				step: 'otp-code' as const,
				phone,
				error: otpErrorMessage(e)
			});
		}

		// Single venue → no picker, finish in the same request.
		if (verified.autoSelect) {
			try {
				return await completeOtpSession({
					cookies,
					fetchFn: fetch,
					selectionToken: verified.selectionToken,
					choice: {
						tenantKey: verified.autoSelect.tenantKey,
						venueSlug: verified.autoSelect.venueSlug
					},
					redirectTo
				});
			} catch (e) {
				if (e && typeof e === 'object' && 'status' in e && 'location' in e) throw e; // redirect
				return fail(500, { step: 'otp-code' as const, phone, error: otpErrorMessage(e) });
			}
		}

		// Multi-venue: park the selection token server-side, show the picker.
		// Named `otpVenues` (not `venues`) so the ActionData union doesn't collide
		// with the legacy picker's differently-shaped `venues` array.
		setSelectionCookie(cookies, verified.selectionToken);
		return {
			step: 'otp-venue' as const,
			userName: verified.user.name,
			otpVenues: verified.venues.map((v: EchoVenueOption) => ({
				tenantKey: v.tenantKey,
				venueSlug: v.venueSlug,
				venueName: v.venueName ?? v.venueSlug,
				department: v.department,
				role: v.role
			}))
		};
	},

	otpSelectVenue: async ({ request, fetch, cookies, url }) => {
		const selectionToken = cookies.get(OTP_SELECTION_COOKIE);
		if (!selectionToken) {
			return fail(401, {
				step: 'otp-phone' as const,
				error: 'Oturum adımı zaman aşımına uğradı — baştan giriş yapın.'
			});
		}
		const form = await request.formData();
		const tenantKey = String(form.get('tenantKey') ?? '').trim();
		const venueSlug = String(form.get('venueSlug') ?? '').trim();
		if (!tenantKey || !venueSlug) {
			return fail(400, { step: 'otp-venue' as const, error: 'Otel seçilmedi.' });
		}

		try {
			return await completeOtpSession({
				cookies,
				fetchFn: fetch,
				selectionToken,
				choice: { tenantKey, venueSlug },
				redirectTo: safeRedirectTarget(url.searchParams.get('redirectTo'))
			});
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) throw e; // redirect
			return fail(e instanceof ApiProblemError ? e.status : 500, {
				step: 'otp-venue' as const,
				error: otpErrorMessage(e)
			});
		}
	},

	// ── Legacy clientSecret flow (transition-only; panelAuth slated for removal) ─

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
			// Dev superadmin preview is NOT a login-form choice — the backend grants it
			// server-side (PANEL_DEV_SUPERADMIN_TENANTS allowlist + NODE_ENV=development),
			// so there's nothing to pass here. whoami below reflects whatever it decided.
			const res = await login({ tenantKey, clientSecret }, opts);
			token = res.accessToken;
			expiresIn = res.expiresIn;
		} catch (e) {
			return fail(401, { error: e instanceof Error ? e.message : 'Giriş başarısız.', tenantKey });
		}

		// Resolve authority once at login (superadmin is per-identity, not per-venue).
		// A whoami failure must not block login — degrade to non-superadmin.
		let isSuperadmin = false;
		try {
			isSuperadmin = (await whoami(token, opts)).isSuperadmin;
		} catch {
			isSuperadmin = false;
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
				identity: { tenantKey, venueSlug: v.slug, venueName: v.name, isSuperadmin }
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
			identity: { tenantKey, venueSlug: first.slug, venueName: first.name, isSuperadmin }
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

		// Read tenantKey from the identity cookie, not the refresh one: RefreshCreds is now
		// a union and only the password variant carries a tenantKey. A demo session never
		// reaches this action anyway (it has one venue and no picker), but reading identity
		// keeps this independent of that.
		const identity = readIdentity(cookies);
		if (!identity) return fail(401, { error: 'Oturum bulunamadı.' });
		// Preserve superadmin resolved at login — a venue switch doesn't change authority.
		setIdentityCookie(cookies, {
			tenantKey: identity.tenantKey,
			venueSlug,
			venueName,
			isSuperadmin: identity.isSuperadmin
		});
		throw redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
