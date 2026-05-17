/**
 * Revora context — the single API surface between any host (revora-panel
 * in Mode A, talkwo-hoops-panel in Mode B1) and Revora pages/widgets.
 *
 * Per spec §6.7 + LAD-7: pages read `getRevoraContext()` to discover
 * mode, identity, subscription, and the JWT to use for API calls.
 *
 * In Phase 2.5, when `@revora/review-ui` is published, this module
 * (or a copy of it) lives in that package. For now it lives in the
 * panel because review-ui is a placeholder.
 */

import { getContext, setContext } from 'svelte';
import type { RevoraSubscription } from '@revora/review-core';

const KEY = Symbol('revora-context');

export interface RevoraContextValue {
	mode: 'standalone' | 'hoops';
	tenantKey: string;
	venueSlug: string;
	venueName: string;
	subscription: RevoraSubscription | null;
	/** JWT used for all Revora API calls inside this subtree.
	 *  Mode A: the OAuth2 Client Credentials token (auto-refreshed by apiFetch).
	 *  Mode B1: the host's session JWT (host owns the lifecycle). */
	jwt: string;
	/** Optional base URL override (staging, hoops embed pointing elsewhere). */
	apiBaseUrl?: string;
}

export function setRevoraContext(value: RevoraContextValue) {
	setContext(KEY, value);
}

export function getRevoraContext(): RevoraContextValue {
	const ctx = getContext<RevoraContextValue>(KEY);
	if (!ctx) {
		throw new Error(
			'getRevoraContext() called outside <RevoraProvider>. ' +
				'Wrap your Revora pages/widgets with <RevoraProvider mode="..." tenantKey="..." ... />.'
		);
	}
	return ctx;
}
