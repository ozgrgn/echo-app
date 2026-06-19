<!--
  LensTabs — the horizontal lens switcher under the venue header (prototype .lens).
  Mirrors the rail icons but as in-canvas tabs: Genel / Rakipler / Platformlar /
  Departmanlar. The rail is the global shortcut; this is the prominent in-page nav.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { osState, type LensKind } from '$lib/stores/osState.svelte';
	import { LayoutGrid, Swords, Globe, Users } from '@lucide/svelte';

	interface Tab {
		kind: LensKind;
		label: string;
		icon: typeof LayoutGrid;
		href: string;
	}

	const tabs: Tab[] = [
		{ kind: 'genel', label: 'Genel', icon: LayoutGrid, href: '/os' },
		{ kind: 'competitors', label: 'Rakipler', icon: Swords, href: '/os/competitors' },
		{ kind: 'platform', label: 'Platformlar', icon: Globe, href: '/os/platform/tripadvisor' },
		{ kind: 'departments', label: 'Departmanlar', icon: Users, href: '/os/departments' }
	];

	const active = $derived(osState.lens.kind);

	function go(tab: Tab) {
		osState.setLens(
			tab.kind === 'platform'
				? { kind: 'platform', platform: 'tripadvisor' }
				: { kind: tab.kind }
		);
		goto(tab.href);
	}
</script>

<!-- Same shape as the platform switcher: individual bordered pills, active one
     filled dark. -->
<div class="mb-4 flex flex-wrap items-center gap-2">
	{#each tabs as tab (tab.kind)}
		{@const Icon = tab.icon}
		{@const isActive = active === tab.kind}
		<button
			onclick={() => go(tab)}
			class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors
				{isActive
				? 'border-transparent bg-text-1 text-white'
				: 'border-border bg-surface-1 text-text-2 hover:bg-surface-2'}"
		>
			<Icon size={15} strokeWidth={2} />
			{tab.label}
		</button>
	{/each}
</div>
