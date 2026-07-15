/**
 * lib/server/radarApi.ts — server-side talkwo-radar binding for the right panel
 * (Gündem / Uyarılar / Hedefler). SAG_PANEL_FAZ1 §4 decision K1: the browser never
 * sees radar; this module is called only from +server.ts proxies.
 *
 * AUTH (the M2M bridge): radar's requireAdmin accepts a `type:'session'` JWT signed
 * with the SHARED JWT_SECRET, carrying {tenantKey, venueId} — radar then scopes every
 * query to that venue (verified in radar auth.middleware.js). So we mint a short-lived
 * session token per call from the panel's own session identity. No radar-side change,
 * no global-admin credential in this app. RADAR_JWT_SECRET must equal radar's
 * JWT_SECRET (NOT echo-api's — they differ in prod).
 *
 * Scope mapping: radar venueId == echo venueSlug and the tenantKey is echo's
 * (rebackfill wrote snapshots under TEN_LAGO_HOTELS/lago-hotel-sorgun) — the slug-join
 * convention, no translation table needed.
 */

import { createHmac } from 'node:crypto';
import { env as privateEnv } from '$env/dynamic/private';

const TOKEN_TTL_S = 120; // per-call, short-lived — minted fresh each request

export interface RadarScope {
	tenantKey: string;
	venueSlug: string; // == radar venueId
}

/** Active alert card from radar's alert_states (written by snapshotScan). */
export interface RadarAlertCard {
	fingerprint: string;
	ruleId?: string;
	title?: string;
	severity?: 'critical' | 'warning' | string;
	status?: string;
	category?: string;
	updatedAt?: string;
	[k: string]: unknown;
}

/** goalReport item from /api/os goals — definition + computed intelligence. */
export interface RadarGoalReport {
	goal: {
		goalId: string;
		label?: string;
		metricPath: string;
		target: number;
		deadline?: string | null;
		source?: string;
	};
	progress?: {
		now: number | null;
		target: number;
		gap: number | null;
		weeklyDelta: number | null;
		trend: 'improving' | 'worsening' | 'flat';
		reached: boolean;
	};
	feasibility?: {
		verdict: 'reached' | 'realistic' | 'stretch' | 'never_achieved';
		verdictTr?: string;
		evidence?: string;
		historyMax?: number | null;
		suggested?: number | null;
	};
	[k: string]: unknown;
}

export interface RadarThread {
	threadId?: string;
	title?: string;
	source?: 'manual' | 'alert' | 'goal' | string;
	status?: string;
	updatedAt?: string;
	[k: string]: unknown;
}

function baseUrl(): string {
	const internal = privateEnv.RADAR_API_INTERNAL_URL;
	if (internal && /^https?:\/\//i.test(internal)) return internal.replace(/\/$/, '');
	const url = privateEnv.RADAR_API_URL;
	if (url && /^https?:\/\//i.test(url)) return url.replace(/\/$/, '');
	// No hardcoded prod fallback on purpose: a wrong default would silently read another
	// environment's alerts. Fail loudly so deploy config is fixed instead.
	throw new Error('RADAR_API_URL (or RADAR_API_INTERNAL_URL) is not set — cannot reach talkwo-radar.');
}

const b64url = (buf: Buffer | string) =>
	Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Mint radar's session-shape JWT (HS256, aud:'radar') without a JWT dependency. */
function mintRadarToken(scope: RadarScope): string {
	const secret = privateEnv.RADAR_JWT_SECRET;
	if (!secret) {
		throw new Error(
			'RADAR_JWT_SECRET is not set. It must equal talkwo-radar\'s JWT_SECRET ' +
				'(set in .env.local for dev, on the echo-app Railway service for prod).'
		);
	}
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = b64url(
		JSON.stringify({
			sub: 'echo-panel',
			type: 'session',
			role: 'viewer',
			tenantKey: scope.tenantKey,
			venueId: scope.venueSlug,
			aud: 'radar',
			iat: now,
			exp: now + TOKEN_TTL_S
		})
	);
	const sig = b64url(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
	return `${header}.${payload}.${sig}`;
}

async function radarGet<T>(scope: RadarScope, path: string, fetchFn: typeof fetch): Promise<T> {
	const res = await fetchFn(`${baseUrl()}${path}`, {
		headers: { Authorization: `Bearer ${mintRadarToken(scope)}` }
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`radar ${res.status} on ${path}: ${body.slice(0, 200)}`);
	}
	return res.json() as Promise<T>;
}

async function radarPost<T>(
	scope: RadarScope,
	path: string,
	body: unknown,
	fetchFn: typeof fetch
): Promise<T> {
	const res = await fetchFn(`${baseUrl()}${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${mintRadarToken(scope)}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`radar ${res.status} on ${path}: ${text.slice(0, 200)}`);
	}
	return res.json() as Promise<T>;
}

/** Active alert cards (assist surface — session token passes its requireAdmin). */
export async function listRadarAlerts(scope: RadarScope, fetchFn: typeof fetch = fetch) {
	const t = encodeURIComponent(scope.tenantKey);
	const v = encodeURIComponent(scope.venueSlug);
	const data = await radarGet<{ alerts: RadarAlertCard[] }>(scope, `/api/assist/${t}/${v}/alerts`, fetchFn);
	return data.alerts ?? [];
}

/** Goal reports (definition + progress + feasibility), from the /api/os facade. */
export async function listRadarGoals(scope: RadarScope, fetchFn: typeof fetch = fetch) {
	const t = encodeURIComponent(scope.tenantKey);
	const v = encodeURIComponent(scope.venueSlug);
	const data = await radarGet<{ goals: RadarGoalReport[] }>(scope, `/api/os/venues/${t}/${v}/goals`, fetchFn);
	return data.goals ?? [];
}

/** Upsert a goal (panel CRUD, P2). Radar computes and returns the full goalReport
 * (definition + progress + feasibility) so the panel can render the new card
 * without a second round-trip. metricPath validation is the PROXY's job — this
 * client forwards what it is given. */
export async function setRadarGoal(
	scope: RadarScope,
	body: { metricPath: string; target: number; label?: string; deadline?: string },
	fetchFn: typeof fetch = fetch
) {
	const t = encodeURIComponent(scope.tenantKey);
	const v = encodeURIComponent(scope.venueSlug);
	return radarPost<RadarGoalReport>(scope, `/api/os/venues/${t}/${v}/goals`, body, fetchFn);
}

/** Reputation-domain topic threads (Gündem). */
export async function listRadarThreads(scope: RadarScope, fetchFn: typeof fetch = fetch) {
	const t = encodeURIComponent(scope.tenantKey);
	const v = encodeURIComponent(scope.venueSlug);
	const data = await radarGet<{ threads: RadarThread[] }>(
		scope,
		`/api/assist/${t}/${v}/threads?domain=reputation`,
		fetchFn
	);
	return data.threads ?? [];
}
