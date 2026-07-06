<!--
  SectionCard — a titled panel with a consistent header (icon + title + optional
  right-hand hint) and body. This is what fixes the "dağınıklık": every panel on
  the OS canvas uses the SAME header rhythm, padding and icon treatment instead of
  ad-hoc inline headers. Icons are Lucide components (single-color, currentColor).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Icon as IconType } from '@lucide/svelte';
	import Card from './Card.svelte';

	interface Props {
		title: string;
		/** Lucide icon component, e.g. import { TrendingUp } and pass `icon={TrendingUp}`. */
		icon?: typeof IconType;
		/** Muted hint on the right of the header (e.g. "son 30 gün"). */
		hint?: string;
		/** Optional rich content on the right (badge etc.) — overrides hint. */
		action?: Snippet;
		padding?: 'sm' | 'md' | 'lg';
		class?: string;
		children: Snippet;
	}

	let { title, icon: Icon, hint, action, padding = 'sm', class: extra = '', children }: Props = $props();

	// Sentence-case the hint (first letter up, rest untouched) for a tidier header —
	// authors write hints lowercase ("son 30 gün"); we present them "Son 30 gün".
	// Turkish locale so a leading 'i' becomes 'İ', not 'I'. Leaves '·'-separated and
	// numeric hints ("14 · ABSA") alone since only the very first char is changed.
	const hintDisplay = $derived(
		hint ? hint.charAt(0).toLocaleUpperCase('tr') + hint.slice(1) : hint
	);
</script>

<Card {padding} class={extra}>
	<div class="mb-3 flex items-center justify-between gap-2">
		<span class="flex items-center gap-2 text-sm font-bold text-text-1">
			{#if Icon}
				<Icon size={16} class="text-text-3" strokeWidth={2} />
			{/if}
			{title}
		</span>
		{#if action}
			{@render action()}
		{:else if hint}
			<span class="text-[11.5px] text-text-3">{hintDisplay}</span>
		{/if}
	</div>
	{@render children()}
</Card>
