<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { setEchoContext } from '$lib/context/echo.svelte';
	import { setApiBaseUrl } from '@talkwo/echo-ui';
	import { env } from '$env/dynamic/public';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';

	let { children, data } = $props();

	// The cookie session (from +layout.server.ts) is the single source of truth
	// for "logged in". The old in-memory auth store is gone — every page reads its
	// data server-side via the session cookie.
	let session = $derived(data?.session ?? null);

	// ── API base URL setup (CLIENT ONLY) ──
	// echo-ui's CLIENT fetch (the few remaining browser calls) points at the public
	// backend. Guard with `browser`: on the server, setApiBaseUrl mutates a shared
	// module global across SSR requests — server code passes baseUrl per call via
	// makeServerApi instead and must never touch this global.
	if (browser && env.PUBLIC_ECHO_API_URL) {
		setApiBaseUrl(env.PUBLIC_ECHO_API_URL);
	}

	// ── Auth guard (client fallback) ──
	// Server layout loads already redirect unauthenticated requests; this is a
	// client-side backstop for in-app navigation. Public routes + mock /os pass.
	$effect(() => {
		const path = page.url.pathname;
		const isPublic = path.startsWith('/login') || path.startsWith('/dev');
		const isMockOs = path.startsWith('/os') && osDataSource.isMock;
		if (!session && !isPublic && !isMockOs) {
			goto('/login');
		}
	});

	// ── ECHOContext setup ──
	// Provide identity to child pages via getEchoContext(). No jwt — data is
	// fetched server-side; nothing client-side reads a token anymore.
	$effect(() => {
		if (session) {
			setEchoContext({
				mode: 'standalone',
				tenantKey: session.tenantKey,
				venueSlug: session.venueSlug,
				venueName: session.venueName ?? session.venueSlug,
				subscription: null,
				jwt: ''
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>ECHO Panel</title>
</svelte:head>

{@render children()}
