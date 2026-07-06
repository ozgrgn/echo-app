<!--
  LensTabs — the horizontal lens switcher under the venue header (prototype .lens).
  Mirrors the rail icons but as in-canvas tabs: Genel / Rakipler / Platformlar /
  Departmanlar. The rail is the global shortcut; this is the prominent in-page nav.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { osState } from '$lib/stores/osState.svelte';
	import { OS_NAV, type OsNavItem } from '$lib/config/osNav';

	// Same OS_NAV config the rail uses — order and hrefs stay in lockstep. Platform
	// lands on the overview index; a channel is picked from there.
	const tabs = OS_NAV;
	const active = $derived(osState.lens.kind);

	function go(tab: OsNavItem) {
		osState.setLens({ kind: tab.lens });
		goto(tab.href);
	}
</script>

<!-- Same shape as the platform switcher: individual bordered pills, active one
     filled dark. -->
<div class="mb-4 flex flex-wrap items-center gap-2">
	{#each tabs as tab (tab.lens)}
		{@const Icon = tab.icon}
		{@const isActive = active === tab.lens}
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
