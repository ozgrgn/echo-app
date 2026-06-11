/**
 * ECHO context — the single API surface between any host (echo-panel
 * in Mode A, talkwo-hoops-panel in Mode B1) and ECHO pages/widgets.
 *
 * Per spec §6.7 + LAD-7: pages read `getEchoContext()` to discover
 * mode, identity, subscription, and the JWT to use for API calls.
 *
 * In Phase 2.5, when `@talkwo/echo-ui` is published, this module
 * (or a copy of it) lives in that package. For now it lives in the
 * panel because echo-ui is a placeholder.
 */

import { getContext, setContext } from 'svelte';
import type { EchoSubscription } from '@talkwo/echo-core';

const KEY = Symbol('echo-context');

export interface EchoContextValue {
	mode: 'standalone' | 'hoops';
	tenantKey: string;
	venueSlug: string;
	venueName: string;
	subscription: EchoSubscription | null;
	/** JWT used for all ECHO API calls inside this subtree.
	 *  Mode A: the OAuth2 Client Credentials token (auto-refreshed by apiFetch).
	 *  Mode B1: the host's session JWT (host owns the lifecycle). */
	jwt: string;
	/** Optional base URL override (staging, hoops embed pointing elsewhere). */
	apiBaseUrl?: string;
}

export function setEchoContext(value: EchoContextValue) {
	setContext(KEY, value);
}

export function getEchoContext(): EchoContextValue {
	const ctx = getContext<EchoContextValue>(KEY);
	if (!ctx) {
		throw new Error(
			'getEchoContext() called outside <EchoProvider>. ' +
				'Wrap your ECHO pages/widgets with <EchoProvider mode="..." tenantKey="..." ... />.'
		);
	}
	return ctx;
}
