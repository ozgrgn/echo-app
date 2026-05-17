/**
 * Auth store — Mode A (standalone) only.
 *
 * In Mode B1 (hoops-panel embed), this module is not used. Instead,
 * hoops-panel's own auth store feeds the JWT/identity into <RevoraProvider>.
 *
 * Per spec §6.4 + HIGH-11: persists only non-sensitive identity to
 * sessionStorage. Token and clientSecret are memory-only — reload requires
 * re-login. Mid-session token expiry is handled transparently by apiFetch
 * (§6.5) using the in-memory clientSecret.
 */

import type { AuthCredentials, RevoraSubscription } from '@revora/review-core';

interface AuthState {
	token: string | null;
	tokenExpiresAt: number | null; // epoch ms
	tenantKey: string | null;
	clientSecret: string | null; // memory-only, never persisted
	venueSlug: string | null;
	venueName: string | null;
	subscription: RevoraSubscription | null;
}

interface PersistedSession {
	tenantKey: string;
	venueSlug: string;
	venueName: string;
}

const SESSION_KEY = 'revora.session';

function loadPersisted(): PersistedSession | null {
	if (typeof window === 'undefined') return null; // SSR safety
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as PersistedSession) : null;
	} catch {
		return null;
	}
}

function persist(session: PersistedSession | null) {
	if (typeof window === 'undefined') return;
	if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
	else sessionStorage.removeItem(SESSION_KEY);
}

function createAuth() {
	// Restore the non-sensitive parts on creation; token/clientSecret stay null
	// until the user logs in this tab.
	const restored = loadPersisted();

	const state = $state<AuthState>({
		token: null,
		tokenExpiresAt: null,
		tenantKey: restored?.tenantKey ?? null,
		clientSecret: null,
		venueSlug: restored?.venueSlug ?? null,
		venueName: restored?.venueName ?? null,
		subscription: null
	});

	return {
		// Getters give us reactive read access in components
		get token() {
			return state.token;
		},
		get tokenExpiresAt() {
			return state.tokenExpiresAt;
		},
		get tenantKey() {
			return state.tenantKey;
		},
		get clientSecret() {
			return state.clientSecret;
		},
		get venueSlug() {
			return state.venueSlug;
		},
		get venueName() {
			return state.venueName;
		},
		get subscription() {
			return state.subscription;
		},
		get isLoggedIn() {
			return state.token !== null && state.venueSlug !== null;
		},

		/** Called by the login page after a successful credentials + venue pick. */
		login(
			creds: AuthCredentials,
			token: string,
			expiresIn: number,
			venueSlug: string,
			venueName: string,
			subscription: RevoraSubscription | null
		) {
			state.token = token;
			state.tokenExpiresAt = Date.now() + expiresIn * 1000;
			state.tenantKey = creds.tenantKey;
			state.clientSecret = creds.clientSecret;
			state.venueSlug = venueSlug;
			state.venueName = venueName;
			state.subscription = subscription;
			persist({ tenantKey: creds.tenantKey, venueSlug, venueName });
		},

		/** Multi-venue tenants: switch active venue without re-login. */
		switchVenue(venueSlug: string, venueName: string) {
			state.venueSlug = venueSlug;
			state.venueName = venueName;
			if (state.tenantKey) {
				persist({ tenantKey: state.tenantKey, venueSlug, venueName });
			}
		},

		/** Replace token after a transparent refresh (apiFetch on 401). */
		updateToken(token: string, expiresIn: number) {
			state.token = token;
			state.tokenExpiresAt = Date.now() + expiresIn * 1000;
		},

		/** Replace cached subscription after fetchTenant() returns new data. */
		updateSubscription(subscription: RevoraSubscription | null) {
			state.subscription = subscription;
		},

		logout() {
			persist(null);
			state.token = null;
			state.tokenExpiresAt = null;
			state.tenantKey = null;
			state.clientSecret = null;
			state.venueSlug = null;
			state.venueName = null;
			state.subscription = null;
		}
	};
}

export const auth = createAuth();
