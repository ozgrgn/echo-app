<!--
  LensTabs — the horizontal lens switcher under the venue header (prototype .lens).
  Mirrors the rail icons but as in-canvas tabs: Genel / Rakipler / Platformlar /
  Departmanlar. The rail is the global shortcut; this is the prominent in-page nav.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { osState } from '$lib/stores/osState.svelte';
	import { OS_NAV, lensForPath, type OsNavItem } from '$lib/config/osNav';
	import { parseOsWindow, hidesCompetitors } from '$lib/config/window';

	// Same OS_NAV config the rail uses — order and hrefs stay in lockstep. Platform
	// lands on the overview index; a channel is picked from there. In the 'max' lens
	// the Rakipler tab is dropped (competitor comparison hidden — matches the rail).
	//
	// Active tab is derived from the URL (lensForPath), NOT osState — the URL is the
	// single source of truth. On HMR the in-memory store resets to its default while
	// the URL stays put, so a store-derived highlight would desync from the page.
	const active = $derived(lensForPath(page.url.pathname) ?? osState.lens.kind);
	const activeWindow = $derived(parseOsWindow(page.url.searchParams.get('window')));
	const tabs = $derived(
		OS_NAV.filter((i) => !(i.lens === 'competitors' && hidesCompetitors(activeWindow)))
	);

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
