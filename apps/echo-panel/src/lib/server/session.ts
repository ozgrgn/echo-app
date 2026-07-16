/**
 * lib/server/session.ts — server-only session cookie management (SSR auth).
 *
 * Three cookies, all HttpOnly (never readable by browser JS):
 *   - echo_jwt      : the access token. maxAge tied to the token's expiresIn.
 *   - echo_refresh  : AES-256-GCM encrypted {tenantKey, clientSecret} for
 *                     transparent server-side 401 re-auth. Long-lived so a
 *                     browser reload no longer forces re-login.
 *   - echo_session  : {tenantKey, venueSlug, venueName} identity. HttpOnly;
 *                     surfaced to the client via +layout.server.ts → PageData,
 *                     so there is a single source of truth (the cookie), not a
 *                     second client-readable copy.
 *
 * This module is server-only (imported from hooks/+*.server.ts). It reads
 * SESSION_SECRET from $env/dynamic/private and uses Node crypto — both hard
 * errors if bundled into the browser, which is the intended guard.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

export const JWT_COOKIE = 'echo_jwt';
export const REFRESH_COOKIE = 'echo_refresh';
export const SESSION_COOKIE = 'echo_session';

/** Long-lived refresh window — a reload within 30 days re-auths silently. */
const REFRESH_MAX_AGE_S = 60 * 60 * 24 * 30;

export interface SessionIdentity {
	tenantKey: string;
	venueSlug: string;
	venueName: string;
	/** Ecosystem superadmin (from /auth/whoami at login). Gates the Yönetim
	 *  surface in the UI; the backend still enforces it via requireSuperadmin. */
	isSuperadmin: boolean;
	/** Marketing demo session (entered via /demo?t=…). Read-only, fixture-served,
	 *  scoped to TEN_DEMO_AURELIA. Hides the write surfaces in the UI and shows the
	 *  "sample data" banner; the backend enforces read-only regardless. */
	isDemo?: boolean;
}

/**
 * What we can re-authenticate with when the access token expires.
 *
 * Three shapes:
 *   - a legacy panel login stores {tenantKey, clientSecret} → silent re-login
 *   - a demo session stores {demoToken} — the long-lived (30-day) link token, which
 *     POST /v1/auth/demo-token exchanges for a fresh 1-hour staff JWT
 *   - an OTP session stores {otpSession: true} — a MARKER, not a credential: OTP
 *     is interactive (SMS), there is nothing to re-login with. The 24h session
 *     token IS the whole session; on 401 the user re-enters the OTP flow.
 *
 * Distinguished by which field is present, not by a discriminator: cookies minted
 * before the demo existed carry clientSecret and must keep working.
 *
 * WHY THIS MATTERS: without the demo branch, a presentation dies exactly one hour in —
 * refresh() would call login() with an undefined clientSecret, fail, and bounce the
 * viewer to /login mid-demo. See echoApi.refresh().
 */
export type RefreshCreds =
	| { tenantKey: string; clientSecret: string }
	| { demoToken: string }
	| { otpSession: true };

/** Type guard: is this a demo session's refresh credential? */
export function isDemoRefresh(c: RefreshCreds): c is { demoToken: string } {
	return 'demoToken' in c;
}

/** Type guard: OTP session marker — no silent re-auth possible (see type doc). */
export function isOtpRefresh(c: RefreshCreds): c is { otpSession: true } {
	return 'otpSession' in c;
}

/** Base cookie attributes shared by all three session cookies. */
function baseCookieOpts(maxAge: number) {
	return {
		httpOnly: true,
		secure: !dev, // plain HTTP is fine on localhost; require HTTPS in prod
		sameSite: 'lax' as const, // top-level navigation after login must send it
		path: '/',
		maxAge
	};
}

// ── AES-256-GCM for the refresh cookie ──────────────────────────────────────
// The clientSecret must never sit in a cookie in plaintext, even HttpOnly:
// encrypt-at-rest is defense in depth (a leaked cookie store stays useless).
// Key is derived from SESSION_SECRET so ops only manage one secret.

function key(): Buffer {
	const secret = env.SESSION_SECRET;
	if (!secret) {
		throw new Error(
			'SESSION_SECRET is not set — required to encrypt the refresh cookie. ' +
				'Set it in .env.local (dev) and on the Railway echo-app service (prod).'
		);
	}
	// Normalize any-length secret to a 32-byte AES-256 key.
	return createHash('sha256').update(secret).digest();
}

/** Encrypt to `iv.tag.ciphertext` (all base64url), one compact cookie value. */
function encrypt(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [iv, tag, ct].map((b) => b.toString('base64url')).join('.');
}

/** Reverse of encrypt(); returns null on any tampering / wrong key / bad format. */
function decrypt(value: string): string | null {
	try {
		const [ivB64, tagB64, ctB64] = value.split('.');
		if (!ivB64 || !tagB64 || !ctB64) return null;
		const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'));
		decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
		const pt = Buffer.concat([
			decipher.update(Buffer.from(ctB64, 'base64url')),
			decipher.final()
		]);
		return pt.toString('utf8');
	} catch {
		return null; // GCM auth failure, malformed input, or key rotation
	}
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Set all three session cookies after a successful login / venue selection. */
export function setSession(
	cookies: Cookies,
	args: {
		token: string;
		expiresIn: number; // seconds
		refresh: RefreshCreds;
		identity: SessionIdentity;
	}
): void {
	cookies.set(JWT_COOKIE, args.token, baseCookieOpts(args.expiresIn));
	cookies.set(REFRESH_COOKIE, encrypt(JSON.stringify(args.refresh)), baseCookieOpts(REFRESH_MAX_AGE_S));
	cookies.set(SESSION_COOKIE, JSON.stringify(args.identity), baseCookieOpts(REFRESH_MAX_AGE_S));
}

/** Rewrite only the JWT cookie after a transparent refresh (keeps refresh/identity). */
export function setJwtCookie(cookies: Cookies, token: string, expiresIn: number): void {
	cookies.set(JWT_COOKIE, token, baseCookieOpts(expiresIn));
}

/** Rewrite only the identity cookie (e.g. venue switch without re-login). */
export function setIdentityCookie(cookies: Cookies, identity: SessionIdentity): void {
	cookies.set(SESSION_COOKIE, JSON.stringify(identity), baseCookieOpts(REFRESH_MAX_AGE_S));
}

/** Read the current JWT, or null. */
export function readJwt(cookies: Cookies): string | null {
	return cookies.get(JWT_COOKIE) ?? null;
}

/** Read and parse the identity cookie, or null. */
export function readIdentity(cookies: Cookies): SessionIdentity | null {
	const raw = cookies.get(SESSION_COOKIE);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<SessionIdentity>;
		if (!parsed.tenantKey || !parsed.venueSlug) return null;
		// Back-compat: cookies minted before isSuperadmin / isDemo existed default to false.
		return {
			tenantKey: parsed.tenantKey,
			venueSlug: parsed.venueSlug,
			venueName: parsed.venueName ?? '',
			isSuperadmin: parsed.isSuperadmin ?? false,
			isDemo: parsed.isDemo ?? false
		};
	} catch {
		return null;
	}
}

/** Decrypt and parse the refresh creds, or null (missing / tampered). */
export function readRefresh(cookies: Cookies): RefreshCreds | null {
	const raw = cookies.get(REFRESH_COOKIE);
	if (!raw) return null;
	const pt = decrypt(raw);
	if (!pt) return null;
	try {
		return JSON.parse(pt) as RefreshCreds;
	} catch {
		return null;
	}
}

/** Clear all session cookies (logout, or failed refresh). */
export function clearSession(cookies: Cookies): void {
	for (const name of [JWT_COOKIE, REFRESH_COOKIE, SESSION_COOKIE]) {
		cookies.delete(name, { path: '/' });
	}
}
