<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import { getRevoraContext } from '$lib/context/revora.svelte';

	let { children } = $props();

	// Read context once — provided by root +layout.svelte after login
	// If user lands here without being logged in, root layout's guard
	// will already have redirected to /login. This is defensive.
	let ctx: ReturnType<typeof getRevoraContext> | null = null;
	try {
		ctx = getRevoraContext();
	} catch {
		ctx = null;
	}

	interface NavItem {
		href: string;
		icon: string;
		label: string;
		requires?: () => boolean;
	}

	const sub = $derived(ctx?.subscription ?? null);

	const allNav: NavItem[] = [
		{ href: '/dashboard', icon: '📊', label: 'Dashboard' },
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

	const navItems = $derived(allNav.filter((i) => !i.requires || i.requires()));

	let collapsed = $state(false);

	function logout() {
		auth.logout();
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
		<!-- Brand -->
		<div class="px-6 pb-4 border-b border-white/10 mb-4">
			<span class="block text-xl font-extrabold text-brand">
				{collapsed ? 'R' : 'Revora'}
			</span>
			{#if !collapsed && auth.venueName}
				<span class="block text-xs text-sidebar-text mt-1 truncate">{auth.venueName}</span>
			{/if}
		</div>

		<!-- Nav -->
		<nav class="flex-1 overflow-y-auto">
			{#each navItems as item (item.href)}
				{@const active = page.url.pathname.startsWith(item.href)}
				<a
					href={item.href}
					class="flex items-center gap-3 px-6 py-3 text-sm border-l-[3px] transition-colors hover:bg-white/5 hover:text-sidebar-text-active"
					class:border-l-transparent={!active}
					class:border-l-sidebar-accent={active}
					class:bg-white={active}
					class:bg-opacity-10={active}
					class:text-sidebar-text-active={active}
					title={collapsed ? item.label : undefined}
				>
					<span class="text-lg shrink-0">{item.icon}</span>
					{#if !collapsed}<span>{item.label}</span>{/if}
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="px-6 pt-4 border-t border-white/10 text-xs space-y-3">
			{#if !collapsed}
				<div>
					<div class="text-sidebar-text/60 mb-0.5">Tenant</div>
					<div class="truncate" title={auth.tenantKey ?? undefined}>{auth.tenantKey}</div>
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
				{navItems.find((i) => page.url.pathname.startsWith(i.href))?.label ?? 'Revora'}
			</h1>
			<div class="flex items-center gap-4 text-sm text-text-2">
				<!-- Period selector + venue switcher come in later phases -->
				<span class="px-3 py-1 rounded-md bg-surface-2 text-xs">Mock Mode</span>
			</div>
		</header>

		<main class="p-8 max-w-[1400px] w-full">
			{@render children()}
		</main>
	</div>
</div>
