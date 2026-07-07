<!--
  ECHO OS shell — the 3-column command center (ECHO_OS_PLAN.md):
    [ rail 58px ] [ canvas (lens views) ] [ assistant 384px ]

  This layout is the parallel /os route — the legacy (app)/dashboard is untouched.
  The rail carries the two global counters (at-risk goals + open alerts) so they're
  reachable from any lens. The assistant column is a placeholder shell in B1; A1
  wires it to the radar federated brain.
-->
<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page, navigating } from '$app/state';
	import { osState } from '$lib/stores/osState.svelte';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';
	import { MOCK_OS_COUNTERS } from '$lib/mock/os';
	import { Target, Bell, Settings, Database } from '@lucide/svelte';
	import { OS_NAV, type OsNavItem } from '$lib/config/osNav';
	import { OS_WINDOW_TABS, parseOsWindow, hidesCompetitors } from '$lib/config/window';
	import AssistantPanel from '$lib/components/AssistantPanel.svelte';
	import TalkwoMark from '$lib/components/TalkwoMark.svelte';
	import LensTabs from '$lib/components/LensTabs.svelte';

	let { children, data } = $props();

	// Rail nav renders from the shared OS_NAV config (single source of truth,
	// mirrored by the in-canvas LensTabs). Lucide icons (single-color, currentColor).
	const activeKind = $derived(osState.lens.kind);
	const isMock = $derived(osDataSource.isMock);

	// These lenses carry their own back button + in-page switcher row, so the
	// global LensTabs would stack a second button row. Hide it on them.
	const hideLensTabs = $derived(
		page.route.id === '/(os)/os/platform/[platform]' ||
			page.route.id === '/(os)/os/departments' ||
			page.route.id === '/(os)/os/department/[dept]'
	);

	// Toggle data source (mock demo ↔ live backend) and re-run the loaders.
	async function toggleSource() {
		osDataSource.toggle();
		await invalidateAll();
	}

	// Data-driven nav: activate the lens, then navigate to its canonical route.
	// Platform lands on the overview index (/os/platform) — a specific channel is
	// picked from there, so no channel hardcode here anymore.
	function go(item: OsNavItem) {
		osState.setLens({ kind: item.lens });
		goto(item.href);
	}

	// Global time-window — URL-driven (`?window=`), so every lens's SSR load reads
	// the same horizon and it survives refresh/share. Active window comes from the
	// URL, not client state (SSR must see it).
	const activeWindow = $derived(parseOsWindow(page.url.searchParams.get('window')));
	function selectWindow(key: string) {
		if (key === activeWindow) return;
		// Preserve the current path + other params; swap only `window` (drop it for
		// the 24mo default to keep URLs clean). invalidateAll re-runs every load so
		// a query-only change on the same route doesn't get skipped.
		const url = new URL(page.url);
		if (key === '24mo') url.searchParams.delete('window');
		else url.searchParams.set('window', key);
		goto(url.pathname + url.search, { keepFocus: true, noScroll: true, invalidateAll: true });
	}
</script>

<div class="grid h-screen overflow-hidden" style="grid-template-columns: 58px 1fr 384px;">
	<!-- ── Rail ──────────────────────────────────────────────────────────── -->
	<nav class="flex flex-col items-center gap-1 border-r border-border bg-surface-1 py-3.5">
		<TalkwoMark size={24} class="mb-3" />

		<!-- 'max' (Tümü) lens hides competitor comparison → drop the Rakipler nav item
		     (owner decision: owned full history isn't comparable to a rival's ~2yr). -->
		{#each OS_NAV.filter((i) => !(i.lens === 'competitors' && hidesCompetitors(activeWindow))) as item (item.lens)}
			{@const Icon = item.icon}
			<button
				onclick={() => go(item)}
				title={item.label}
				class="grid h-10 w-10 place-items-center rounded-xl transition-colors
					{activeKind === item.lens
					? 'bg-text-1 text-white'
					: 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
			>
				<Icon size={19} strokeWidth={2} />
			</button>
		{/each}

		<!-- Global time-window selector — vertical, centered. Sets ?window= on the URL
		     so every lens reflects the same horizon (2 Yıl = full history, default). -->
		<div class="mt-3 flex flex-col items-center gap-1 border-t border-border pt-3">
			{#each OS_WINDOW_TABS as t (t.key)}
				<button
					onclick={() => selectWindow(t.key)}
					title="Zaman aralığı: {t.label}"
					class="grid h-8 w-9 place-items-center rounded-lg text-[11px] font-bold transition-colors
						{activeWindow === t.key
						? 'bg-brand/12 text-brand'
						: 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
				>
					{t.short}
				</button>
			{/each}
		</div>

		<div class="flex-1"></div>

		<!-- Global counters: at-risk goals + open alerts (reachable from any lens) -->
		<button
			title="{MOCK_OS_COUNTERS.atRiskGoals} risk altındaki hedef"
			class="relative grid h-10 w-10 place-items-center rounded-xl text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
		>
			<Target size={19} strokeWidth={2} />
			{#if MOCK_OS_COUNTERS.atRiskGoals > 0}
				<span class="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-bold text-white">
					{MOCK_OS_COUNTERS.atRiskGoals}
				</span>
			{/if}
		</button>
		<button
			title="{MOCK_OS_COUNTERS.openAlerts} açık uyarı"
			class="relative grid h-10 w-10 place-items-center rounded-xl text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
		>
			<Bell size={19} strokeWidth={2} />
			{#if MOCK_OS_COUNTERS.openAlerts > 0}
				<span class="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
					{MOCK_OS_COUNTERS.openAlerts}
				</span>
			{/if}
		</button>

		<!-- Data source toggle: rich demo mock ↔ live backend. -->
		<button
			onclick={toggleSource}
			title={isMock ? 'Veri: MOCK (demo) — canlıya geç' : 'Veri: CANLI — mock\'a geç'}
			class="relative grid h-10 w-10 place-items-center rounded-xl transition-colors
				{isMock ? 'bg-talkwo/15 text-talkwo' : 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
		>
			<Database size={19} strokeWidth={2} />
			<span class="absolute -bottom-0.5 right-0.5 text-[8px] font-extrabold {isMock ? 'text-talkwo' : 'text-text-3'}">
				{isMock ? 'M' : 'C'}
			</span>
		</button>

		<button
			onclick={() => goto('/dashboard')}
			title="Klasik panele dön"
			class="grid h-10 w-10 place-items-center rounded-xl text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
		>
			<Settings size={19} strokeWidth={2} />
		</button>
	</nav>

	<!-- ── Canvas (lens views render here) ───────────────────────────────── -->
	<!-- Slightly cooler/darker than --color-bg so the white cards read as raised. -->
	<main class="relative overflow-y-auto px-7 py-6" style="background:#eef0f4">
		<!-- Navigation feedback: an indeterminate top bar while a lens load resolves.
		     SvelteKit holds the old page until `load` settles; this is the only cue
		     that a click registered. Rendered only during navigation, so no flicker
		     on instant transitions. -->
		{#if navigating.to}
			<div class="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-brand/15">
				<div class="nav-progress h-full w-1/3 bg-brand"></div>
			</div>
		{/if}

		<!-- Global lens menu — fixed above every lens's own hero/content.
		     Hidden on the platform detail page, which carries its own back nav. -->
		{#if !hideLensTabs}
			<LensTabs />
		{/if}
		{@render children()}
	</main>

	<!-- ── Assistant (skeleton shell — A1 wires the radar brain) ─────────── -->
	<aside class="overflow-hidden border-l border-border bg-surface-1 shadow-[-16px_0_40px_-24px_rgba(15,23,42,0.18)]">
		<AssistantPanel venueName={data?.session?.venueName ?? 'Lago Hotel Sorgun'} />
	</aside>
</div>

<style>
	/* Indeterminate progress: a short segment sweeps left→right while loading. */
	.nav-progress {
		animation: nav-sweep 0.9s ease-in-out infinite;
	}
	@keyframes nav-sweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}
</style>
