/**
 * Authenticated fetch helper.
 *
 * Per spec §6.5: reads JWT from the ECHO context (works in both
 * Mode A and Mode B1), transparently refreshes on 401 if and only if
 * we still have the credentials in memory (Mode A only — Mode B1
 * surfaces the 401 to the host).
 *
 * USAGE inside a Svelte component:
 *   const ctx = getEchoContext();
 *   const res = await apiFetch(ctx, '/scores/lago-hotel-sorgun?period=2025-05');
 *
 * USAGE inside SvelteKit load() functions: see api wrappers (next step).
 */

import { login, getApiBaseUrl, type AuthCredentials } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import type { EchoContextValue } from '$lib/context/echo.svelte';

export class ApiError extends Error {
	constructor(
		public status: number,
		public detail: string,
		public requestId?: string,
		public body?: unknown
	) {
		super(`${status} ${detail}`);
	}
}

/**
 * Wrap fetch with Authorization header + transparent 401 refresh.
 *
 * The context provides the *initial* JWT. If a refresh happens (Mode A),
 * we update the auth store but DON'T mutate the context — the next call
 * will re-read auth.token directly. This sidesteps the immutable-props
 * nature of Svelte contexts.
 */
export async function apiFetch(
	ctx: EchoContextValue,
	path: string,
	init: RequestInit = {}
): Promise<Response> {
	const baseUrl = ctx.apiBaseUrl ?? getApiBaseUrl();

	// In Mode A after a 401 refresh, auth.token has the fresh value.
	// In Mode B1, auth.token is null — we always use ctx.jwt.
	const currentToken = auth.token ?? ctx.jwt;

	const doFetch = (token: string) =>
		fetch(`${baseUrl}${path}`, {
			...init,
			headers: {
				...(init.headers || {}),
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		});

	let res = await doFetch(currentToken);

	// Mode A only: transparent refresh on 401
	const canRefresh = ctx.mode === 'standalone' && auth.tenantKey && auth.clientSecret;
	if (res.status === 401 && canRefresh) {
		try {
			const creds: AuthCredentials = {
				tenantKey: auth.tenantKey!,
				clientSecret: auth.clientSecret!
			};
			const fresh = await login(creds);
			auth.updateToken(fresh.accessToken, fresh.expiresIn);
			res = await doFetch(fresh.accessToken);
		} catch {
			// Refresh failed — propagate the original 401 upward
		}
	}

	return res;
}

/**
 * Parse a non-OK response into a typed ApiError per RFC 7807 (API.md §8).
 * Most callers should: `if (!res.ok) throw await toApiError(res);`
 */
export async function toApiError(res: Response): Promise<ApiError> {
	const body = await res.json().catch(() => ({}));
	const detail = (body && typeof body === 'object' && 'detail' in body && String(body.detail)) || res.statusText || 'Request failed';
	const requestId = (body && typeof body === 'object' && 'requestId' in body && String(body.requestId)) || undefined;
	return new ApiError(res.status, detail, requestId, body);
}
