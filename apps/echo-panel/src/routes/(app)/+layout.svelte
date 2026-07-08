<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getEchoContext } from '$lib/context/echo.svelte';
	import { MOCK_CONFIG } from '@talkwo/echo-ui';

	let { children, data } = $props();

	// Mock badge reflects the ACTUAL per-domain mock state (api.ts MOCK_CONFIG),
	// not a hardcoded label. As real endpoints come online and flags flip to
	// false, the badge downgrades from "Mock Mode" → "Kısmi Mock" → hidden.
	const mockDomains = Object.entries(MOCK_CONFIG)
		.filter(([, isMock]) => isMock)
		.map(([domain]) => domain);
	const mockLabel =
		mockDomains.length === 0
			? null
			: mockDomains.length === Object.keys(MOCK_CONFIG).length
				? 'Mock Mode'
				: `Kısmi Mock (${mockDomains.join(', ')})`;

	// Read context once — provided by root +layout.svelte after login
	// If user lands here without being logged in, root layout's guard
	// will already have redirected to /login. This is defensive.
	let ctx: ReturnType<typeof getEchoContext> | null = null;
	try {
		ctx = getEchoContext();
	} catch {
		ctx = null;
	}

	interface NavItem {
		href: string;
		icon: string;
		label: string;
		requires?: () => boolean;
	}

	/** A labeled section of nav items whose whole visibility can be gated at once. */
	interface NavGroup {
		label: string;
		requires?: () => boolean;
		items: NavItem[];
	}

	const sub = $derived(ctx?.subscription ?? null);
	const isSuperadmin = $derived(data?.session?.isSuperadmin ?? false);

	// Top-level (ungrouped) items — visible per their own `requires`.
	const primaryNav: NavItem[] = [
		{ href: '/dashboard', icon: '📊', label: 'Dashboard' },
		{ href: '/os', icon: '⚡', label: 'ECHO OS (beta)' },
		{
			href: '/portfolio',
			icon: '🏢',
			label: 'Portföy',
			requires: () => sub?.features.includes('portfolio_view') ?? false
		},
		{ href: '/categories', icon: '🏷️', label: 'Kategoriler' },
		{
			href: '/benchmark',
			icon: '🏆',
			label: 'Benchmark',
			requires: () => (sub?.limits.competitors ?? 0) > 0
		},
		{ href: '/reviews', icon: '💬', label: 'Yorumlar' },
		// Survey + Feedback are Mode B1 only
		{ href: '/survey', icon: '📋', label: 'Anket', requires: () => ctx?.mode === 'hoops' },
		{
			href: '/feedback',
			icon: '⚠️',
			label: 'Geribildirim',
			requires: () => ctx?.mode === 'hoops'
		},
		{ href: '/settings', icon: '⚙️', label: 'Ayarlar' }
	];

	// Yönetim — superadmin-only group. Owner Routing lives here now (was a
	// standalone item); the whole group is gated, so routing is superadmin-only too.
	// Route paths are unchanged — only the sidebar grouping/gating moved. Owner
	// Routing (/settings/owner-routing) is listed first so the startsWith active-
	// match below picks the more specific path before /settings.
	const adminGroup: NavGroup = {
		label: 'Yönetim',
		requires: () => isSuperadmin,
		items: [
			{ href: '/settings/owner-routing', icon: '🧭', label: 'Yönlendirme' },
			{ href: '/admin', icon: '🛠️', label: 'Venue / Platform' }
		]
	};

	const primaryItems = $derived(primaryNav.filter((i) => !i.requires || i.requires()));
	const showAdminGroup = $derived(!adminGroup.requires || adminGroup.requires());
	// Flat list of every currently-visible item, sorted longest-href-first so the
	// startsWith title lookup below resolves the most specific path — e.g.
	// /settings/owner-routing must win over /settings (they share a prefix).
	const visibleItems = $derived(
		[...primaryItems, ...(showAdminGroup ? adminGroup.items : [])].sort(
			(a, b) => b.href.length - a.href.length
		)
	);
	// The single active item = the most specific href that prefixes the current
	// path (visibleItems is longest-first, so the first match is the winner). This
	// prevents /settings from also lighting up while on /settings/owner-routing.
	const activeHref = $derived(
		visibleItems.find((i) => page.url.pathname.startsWith(i.href))?.href ?? null
	);

	let collapsed = $state(false);

	async function logout() {
		// Clear the HttpOnly session cookies server-side, then go to login.
		try {
			await fetch('/logout', { method: 'POST' });
		} catch {
			/* cookie clear best-effort */
		}
		goto('/login');
	}
</script>

<div class="flex min-h-screen">
	<!-- Sidebar -->
	<aside
		class="fixed top-0 left-0 h-screen flex flex-col bg-sidebar-bg text-sidebar-text py-4 transition-[width] duration-200 z-20"
		class:w-[240px]={!collapsed}
		class:w-16={collapsed}
	>
		<!-- Brand: standart lockup — beyaz talkwo wordmark + mavi ECHO -->
		<div class="px-6 pb-4 border-b border-white/10 mb-4">
			{#if collapsed}
				<svg viewBox="0 0 72.2199 75.8007" class="w-7 h-auto" aria-label="Talkwo ECHO">
					<defs>
						<linearGradient id="tw-mark" x1="48.3" y1="27" x2="63.7" y2=".3" gradientUnits="userSpaceOnUse">
							<stop offset="0" stop-color="#4f46e5" />
							<stop offset="1" stop-color="#a855f7" />
						</linearGradient>
					</defs>
					<path d="M41.2381,18.8656v54.944c0,1.0996-.8914,1.991-1.991,1.991h-12.8835c-1.0996,0-1.991-.8914-1.991-1.991V18.866H1.991c-1.0996,0-1.991-.8914-1.991-1.991V3.991c0-1.0996.8914-1.991,1.991-1.991h22.3814c9.3146,0,16.8656,7.551,16.8656,16.8656h0Z" fill="#4f46e5" />
					<path d="M69.6005,5.9817v8.9026c0,2.1871-1.7946,3.9817-3.9816,3.9817h-13.9638l-6.4353,6.4352V8.4492c0-3.5612,2.8882-6.4492,6.4491-6.4492h13.9499c2.187,0,3.9816,1.7806,3.9816,3.9817h0Z" fill="url(#tw-mark)" />
				</svg>
			{:else}
				<svg viewBox="0 -8 645 86" class="h-5 w-auto" aria-label="talkwo ECHO"><g fill="#fff"><path d="M103.6811,21.0506v45.8702c0,1.0248-.8308,1.8556-1.8556,1.8556h-10.7774c-1.0248,0-1.8556-.8308-1.8556-1.8556v-2.6601c-3.4808,3.669-8.1853,5.7393-14.301,5.7393-14.3941,0-24.7435-11.1022-24.7435-25.9671s10.3493-25.0261,24.7435-25.0261c6.1157,0,10.8202,1.8814,14.301,5.3629v-3.3191c0-1.0248.8308-1.8556,1.8556-1.8556h10.7774c1.0248,0,1.8556.8308,1.8556,1.8556ZM88.6273,44.0329c0-7.2443-4.6101-12.2307-11.4773-12.2307-6.5865,0-11.3841,5.1747-11.3841,12.2307s4.7045,12.1363,11.3841,12.1363c6.8672,0,11.4773-4.9865,11.4773-12.1363Z"/><path d="M114.0078.002h12.0011c1.0248,0,1.8556.8308,1.8556,1.8556v65.0633c0,1.0248-.8308,1.8556-1.8556,1.8556h-12.0011c-1.0248,0-1.8556-.8308-1.8556-1.8556V1.8575c0-1.0248.8308-1.8556,1.8556-1.8556Z"/><path d="M38.4325,15.7182v51.2059c0,1.0248-.8308,1.8556-1.8556,1.8556h-12.007c-1.0248,0-1.8556-.8308-1.8556-1.8556V15.7185H1.8556c-1.0248,0-1.8556-.8308-1.8556-1.8556V1.8556C0,.8308.8308,0,1.8556,0h20.8587c8.6809,0,15.7182,7.0373,15.7182,15.7182Z"/><path d="M167.1865,68.0091l-15.2498-21.06v19.9717c0,1.0248-.8308,1.8556-1.8556,1.8556h-12.0011c-1.0248,0-1.8556-.8308-1.8556-1.8556V1.8575c0-1.0248.8308-1.8556,1.8556-1.8556h12.0011c1.0248,0,1.8556.8308,1.8556,1.8556v36.1541l14.5899-18.1246c.3522-.4376.8837-.692,1.4454-.692h12.6364c1.5594,0,2.4233,1.8068,1.4443,3.0205l-16.0039,19.8416,16.5943,23.8025c.8576,1.2301-.0226,2.9168-1.5222,2.9168h-12.4316c-.595,0-1.1539-.2853-1.5029-.7673Z"/><path d="M261.7118,21.5078l-11.6629,45.8702c-.2091.8225-.9497,1.3983-1.7983,1.3983h-15.5243c-.8627,0-1.6116-.5945-1.8072-1.4347l-7.0052-30.0828-6.7314,30.0674c-.1898.8476-.9421,1.4502-1.8107,1.4502h-15.7016c-.8475,0-1.5872-.5742-1.7975-1.3951l-11.7503-45.8702c-.3007-1.1737.5859-2.316,1.7975-2.316h11.9895c.8838,0,1.6449.6233,1.8191,1.4897l6.4745,32.1919,6.6558-32.2016c.1781-.8618.9371-1.48,1.8171-1.48h14.4815c.8782,0,1.6361.6156,1.8161,1.4751l6.7471,32.2065,6.2921-32.1821c.1703-.871.9336-1.4995,1.8211-1.4995h12.0799c1.2102,0,2.0966,1.1399,1.7983,2.3128Z"/><path d="M262.7247,44.0329c0-14.865,11.2897-25.9671,27.0963-25.9671,15.8998,0,27.1895,11.1022,27.1895,25.9671,0,14.7705-11.2897,25.9671-27.1895,25.9671-15.8066,0-27.0963-11.1966-27.0963-25.9671ZM301.2052,43.9385c0-7.0561-4.4225-11.9481-11.2897-11.9481s-11.3841,4.892-11.3841,12.0425c0,6.9617,4.5156,12.0425,11.3841,12.0425,6.7728,0,11.2897-4.9865,11.2897-12.137Z"/><path d="M64.8646,3.7112v8.2968c0,2.0383-1.6725,3.7107-3.7107,3.7107h-13.0135l-5.9973,5.9972V6.0108C42.143,2.692,44.8346.0005,48.1533.0005h13.0006c2.0382,0,3.7107,1.6594,3.7107,3.7107Z"/></g><line x1="350" y1="4" x2="350" y2="66" stroke="#fff" stroke-opacity=".3" stroke-width="2"/><text x="374" y="68" font-family="'Poppins', sans-serif" font-weight="600" font-size="94" letter-spacing="-2" fill="#3b82f6">ECHO</text></svg>
				{#if data?.session?.venueName}
					<span class="block text-xs text-sidebar-text mt-2 truncate">{data?.session?.venueName}</span>
				{/if}
			{/if}
		</div>

		<!-- Nav -->
		<nav class="flex-1 overflow-y-auto">
			{#snippet navLink(item: NavItem)}
				{@const active = activeHref === item.href}
				<a
					href={item.href}
					class={[
						'flex items-center gap-3 px-6 py-3 text-sm border-l-[3px] transition-colors hover:bg-white/5 hover:text-sidebar-text-active',
						active
							? 'border-l-sidebar-accent bg-white/10 text-sidebar-text-active'
							: 'border-l-transparent'
					]}
					title={collapsed ? item.label : undefined}
				>
					<span class="text-lg shrink-0">{item.icon}</span>
					{#if !collapsed}<span>{item.label}</span>{/if}
				</a>
			{/snippet}

			{#each primaryItems as item (item.href)}
				{@render navLink(item)}
			{/each}

			<!-- Yönetim (superadmin-only group) -->
			{#if showAdminGroup}
				{#if !collapsed}
					<div
						class="px-6 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-text/50"
					>
						{adminGroup.label}
					</div>
				{:else}
					<div class="mx-6 my-2 border-t border-white/10"></div>
				{/if}
				{#each adminGroup.items as item (item.href)}
					{@render navLink(item)}
				{/each}
			{/if}
		</nav>

		<!-- Footer -->
		<div class="px-6 pt-4 border-t border-white/10 text-xs space-y-3">
			{#if !collapsed}
				<div>
					<div class="text-sidebar-text/60 mb-0.5">Tenant</div>
					<div class="truncate" title={(data?.session?.tenantKey) ?? undefined}>{data?.session?.tenantKey}</div>
				</div>
				<button
					onclick={logout}
					class="block text-sidebar-text hover:text-sidebar-text-active hover:underline"
				>
					Çıkış yap
				</button>
			{/if}
			<button
				onclick={() => (collapsed = !collapsed)}
				class="block text-sidebar-text hover:text-sidebar-text-active"
				aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
				title={collapsed ? 'Genişlet' : 'Daralt'}
			>
				{collapsed ? '→' : '←'}
			</button>
		</div>
	</aside>

	<!-- Main column -->
	<div
		class="flex flex-col flex-1 transition-[margin] duration-200"
		class:ml-[240px]={!collapsed}
		class:ml-16={collapsed}
	>
		<!-- Topbar -->
		<header
			class="sticky top-0 z-10 bg-surface-1 border-b border-border px-8 py-4 flex items-center justify-between"
		>
			<h1 class="text-lg font-semibold text-text-1">
				{visibleItems.find((i) => page.url.pathname.startsWith(i.href))?.label ?? 'ECHO'}
			</h1>
			<div class="flex items-center gap-4 text-sm text-text-2">
				<!-- Period selector + venue switcher come in later phases -->
				{#if mockLabel}
					<span class="px-3 py-1 rounded-md bg-surface-2 text-xs" title="Hâlâ mock veri kullanan alanlar: {mockDomains.join(', ')}">{mockLabel}</span>
				{/if}
			</div>
		</header>

		<main class="p-8 max-w-[1400px] w-full">
			{@render children()}
		</main>
	</div>
</div>
