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
	import { page } from '$app/state';
	import { osState } from '$lib/stores/osState.svelte';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';
	import { MOCK_OS_COUNTERS } from '$lib/mock/os';
	import { LayoutGrid, Globe, Swords, Users, Target, Bell, Settings, Database } from '@lucide/svelte';
	import AssistantPanel from '$lib/components/AssistantPanel.svelte';
	import TalkwoMark from '$lib/components/TalkwoMark.svelte';
	import LensTabs from '$lib/components/LensTabs.svelte';

	let { children, data } = $props();

	// Rail nav — top maps to lenses. Lucide icons (single-color, currentColor).
	const rail = [
		{ icon: LayoutGrid, label: 'Genel', lens: 'genel' as const },
		{ icon: Globe, label: 'Platformlar', lens: 'platform' as const },
		{ icon: Swords, label: 'Rakipler', lens: 'competitors' as const },
		{ icon: Users, label: 'Departmanlar', lens: 'departments' as const }
	];

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

	function go(lens: (typeof rail)[number]['lens']) {
		// Genel/competitors/departments route directly; platform needs a pick →
		// default to tripadvisor for now (lens selection deepens in later phases).
		if (lens === 'genel') {
			osState.setLens({ kind: 'genel' });
			goto('/os');
		} else if (lens === 'platform') {
			osState.setLens({ kind: 'platform', platform: 'tripadvisor' });
			goto('/os/platform/tripadvisor');
		} else if (lens === 'competitors') {
			osState.setLens({ kind: 'competitors' });
			goto('/os/competitors');
		} else if (lens === 'departments') {
			osState.setLens({ kind: 'departments' });
			goto('/os/departments');
		}
	}
</script>

<div class="grid h-screen overflow-hidden" style="grid-template-columns: 58px 1fr 384px;">
	<!-- ── Rail ──────────────────────────────────────────────────────────── -->
	<nav class="flex flex-col items-center gap-1 border-r border-border bg-surface-1 py-3.5">
		<TalkwoMark size={24} class="mb-3" />

		{#each rail as item (item.lens)}
			{@const Icon = item.icon}
			<button
				onclick={() => go(item.lens)}
				title={item.label}
				class="grid h-10 w-10 place-items-center rounded-xl transition-colors
					{activeKind === item.lens
					? 'bg-text-1 text-white'
					: 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
			>
				<Icon size={19} strokeWidth={2} />
			</button>
		{/each}

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
	<main class="overflow-y-auto px-7 py-6" style="background:#eef0f4">
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
