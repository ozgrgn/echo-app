<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { auth } from '$lib/stores/auth.svelte';
	import { setRevoraContext } from '$lib/context/revora.svelte';
	import { setApiBaseUrl } from '@revora/review-core';
	import { env } from '$env/dynamic/public';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { children } = $props();

	// ── API base URL setup ──
	// Point review-core's API client at the configured backend. Falls back
	// to the package default (production Railway URL) if the env var is unset.
	// Runs once at module init — not reactive.
	if (env.PUBLIC_REVORA_API_URL) {
		setApiBaseUrl(env.PUBLIC_REVORA_API_URL);
	}

	// ── Auth guard ──
	// If not logged in and not heading to /login, redirect to /login.
	// Runs on client only (goto is no-op during SSR).
	$effect(() => {
		const path = page.url.pathname;
		const isPublic = path.startsWith('/login') || path.startsWith('/dev');
		if (!auth.isLoggedIn && !isPublic) {
			goto('/login');
		}
	});

	// ── RevoraContext setup ──
	// Once we have a session, push it into context so all child pages
	// can read tenantKey/venueSlug/jwt/subscription via getRevoraContext().
	$effect(() => {
		if (auth.isLoggedIn && auth.tenantKey && auth.venueSlug && auth.token) {
			setRevoraContext({
				mode: 'standalone',
				tenantKey: auth.tenantKey,
				venueSlug: auth.venueSlug,
				venueName: auth.venueName ?? auth.venueSlug,
				subscription: auth.subscription,
				jwt: auth.token
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Revora Panel</title>
</svelte:head>

{@render children()}
