<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { auth } from '$lib/stores/auth.svelte';
	import { setEchoContext } from '$lib/context/echo.svelte';
	import { setApiBaseUrl } from '@talkwo/echo-ui';
	import { env } from '$env/dynamic/public';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';

	let { children, data } = $props();

	// A valid cookie session (from +layout.server.ts) counts as logged in even
	// before the in-memory store is populated — otherwise an SSR page load or a
	// reload would bounce a cookie-authenticated user to /login.
	let hasServerSession = $derived(!!data?.session);

	// ── API base URL setup (CLIENT ONLY) ──
	// Point echo-ui's CLIENT fetch at the configured backend. Guard with `browser`:
	// on the server, setApiBaseUrl mutates a shared module global across all SSR
	// requests (cross-request contamination) — server code passes baseUrl per call
	// via makeServerApi instead, and must never touch this global.
	if (browser && env.PUBLIC_ECHO_API_URL) {
		setApiBaseUrl(env.PUBLIC_ECHO_API_URL);
	}

	// ── Auth guard ──
	// If not logged in and not heading to /login, redirect to /login.
	// Runs on client only (goto is no-op during SSR).
	$effect(() => {
		const path = page.url.pathname;
		const isPublic = path.startsWith('/login') || path.startsWith('/dev');
		// /os in MOCK mode needs no backend/auth — let it through even without a
		// session (so a presentation survives a full page reload / direct URL).
		const isMockOs = path.startsWith('/os') && osDataSource.isMock;
		if (!auth.isLoggedIn && !hasServerSession && !isPublic && !isMockOs) {
			goto('/login');
		}
	});

	// ── ECHOContext setup ──
	// Once we have a session, push it into context so all child pages
	// can read tenantKey/venueSlug/jwt/subscription via getEchoContext().
	$effect(() => {
		if (auth.isLoggedIn && auth.tenantKey && auth.venueSlug && auth.token) {
			setEchoContext({
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
	<title>ECHO Panel</title>
</svelte:head>

{@render children()}
