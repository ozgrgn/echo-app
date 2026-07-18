<!--
  Card — the single surface primitive. Every panel/tile composes from this so
  elevation, radius, border and padding stay consistent across the dashboard
  (previously each page re-typed `bg-surface-1 border border-border rounded-lg shadow-sm`).

  `tone` sets a left accent stripe for status-bearing cards (KPI zones). `interactive`
  lifts the card on hover (use for clickable tiles). `as` lets it render as <a>/<button>
  while keeping the same look.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
	type Pad = 'sm' | 'md' | 'lg';

	interface Props {
		tone?: Tone;
		padding?: Pad;
		interactive?: boolean;
		/** Render element — 'div' (default), 'a', 'article', 'section'. */
		as?: 'div' | 'a' | 'article' | 'section';
		href?: string;
		title?: string;
		/** Fill the parent's height and lay the body out as a column so a flex-1
		 *  child (e.g. a chart) can grow to occupy the card. Opt-in; off by default. */
		fill?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		tone = 'neutral',
		padding = 'md',
		interactive = false,
		as = 'div',
		href,
		title,
		fill = false,
		class: extra = '',
		children
	}: Props = $props();

	const padClass = $derived({ sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding]);

	// Left accent stripe — only drawn for status tones, so neutral cards stay clean.
	const toneStripe: Record<Tone, string> = {
		neutral: '',
		success: 'border-l-4 border-l-success',
		warning: 'border-l-4 border-l-warning',
		danger: 'border-l-4 border-l-danger',
		brand: 'border-l-4 border-l-brand'
	};

	const base =
		'bg-surface-1 border border-border rounded-xl shadow-card transition-all duration-200';
	const hover = $derived(
		interactive
			? 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30'
			: ''
	);

	const fillCls = $derived(fill ? 'flex flex-col h-full' : '');
	const cls = $derived(`${base} ${hover} ${toneStripe[tone]} ${padClass} ${fillCls} ${extra}`);
</script>

{#if as === 'a'}
	<a {href} {title} class={cls}>{@render children()}</a>
{:else if as === 'article'}
	<article class={cls}>{@render children()}</article>
{:else if as === 'section'}
	<section class={cls}>{@render children()}</section>
{:else}
	<div class={cls}>{@render children()}</div>
{/if}
