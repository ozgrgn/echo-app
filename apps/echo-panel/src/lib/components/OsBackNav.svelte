<!--
  OsBackNav — the SINGLE shared "escape row" for OS detail/list lenses.

  Before this component every detail/list lens hand-rolled its own back row, and
  they drifted: Departmanlar said "← Geri → /os", the platform detail said
  "🌐 Genel" but actually went to /os/platform (NOT the real Genel), and none of
  them offered a one-click route to the actual home. Getting back to the main page
  from a department detail meant a two-hop, same-looking "Geri" journey.

  This mirrors the osNav.ts philosophy (one source of truth for the rail + LensTabs)
  down to the detail pages. The rule this component encodes:

    • Home (🏠) is ALWAYS present and ALWAYS goes to /os (the main page). Fixed,
      predictable — the one affordance that means "take me home" everywhere.
    • Back (← Geri) is OPTIONAL and goes to a FIXED parent level (the owning list),
      not history.back(): a department detail's parent is always /os/departments,
      regardless of where the user arrived from. List pages omit Back entirely,
      because for them "one level up" already IS home.

  The page-specific horizontal switcher (department pills / platform pills) is NOT
  owned here — pages pass it via the default slot. This component owns only the
  escape affordances; the lateral switcher stays flexible per lens.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { Home, ArrowLeft } from '@lucide/svelte';
	import { osState, type LensKind } from '$lib/stores/osState.svelte';

	interface Props {
		/** Where Home goes. Always the main page unless a lens needs otherwise. */
		homeHref?: string;
		/** Lens to activate on Home click (keeps osState in sync with the URL). */
		homeLens?: LensKind;
		/** Fixed parent level for "← Geri". Omit on list pages (no Back rendered). */
		backTo?: string;
		/** Lens to activate on Back click. */
		backLens?: LensKind;
		/** Page-specific switcher pills (department / platform) render here. */
		children?: import('svelte').Snippet;
	}

	let {
		homeHref = '/os',
		homeLens = 'genel',
		backTo,
		backLens,
		children
	}: Props = $props();

	function goHome() {
		osState.setLens({ kind: homeLens });
		goto(homeHref);
	}
	function goBack() {
		if (!backTo) return;
		if (backLens) osState.setLens({ kind: backLens });
		goto(backTo);
	}
</script>

<div class="mb-3.5 flex flex-wrap items-center gap-2">
	<!-- Home — always present, always → the main page. Rendered as a compact SQUARE
	     button (same height as the text pills, but only wide enough to hold the icon)
	     so it reads as a distinct "home" affordance, not one of the switcher pills. -->
	<button
		onclick={goHome}
		title="Ana sayfa"
		class="grid h-[33px] w-[33px] flex-none place-items-center rounded-lg border border-border bg-surface-1 text-text-2 transition-colors hover:bg-surface-2"
	>
		<Home size={15} strokeWidth={2} />
		<span class="sr-only">Ana sayfa</span>
	</button>

	<!-- Back — only on detail pages; fixed parent (owning list), not history. -->
	{#if backTo}
		<button
			onclick={goBack}
			class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
		>
			<ArrowLeft size={15} strokeWidth={2} />
			Geri
		</button>
	{/if}

	{#if backTo || children}
		<span class="mx-0.5 h-5 w-px bg-border"></span>
	{/if}

	<!-- Page-specific switcher (department / platform pills). -->
	{@render children?.()}
</div>
