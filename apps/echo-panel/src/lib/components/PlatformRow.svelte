<!--
  PlatformRow — one clickable platform line in the Genel lens "Platformlar" list.
  Clicking enters that platform's universe lens. Score + trend arrow on the right.
-->
<script lang="ts">
	import type { OsPlatform } from '$lib/mock/os';
	import { PLATFORM_COLOR } from '$lib/mock/os';
	import { TrendingUp, TrendingDown, Minus, ChevronRight } from '@lucide/svelte';

	interface Props {
		platform: OsPlatform;
		onenter?: (key: OsPlatform['key']) => void;
	}

	let { platform, onenter }: Props = $props();

	const TrendIcon = $derived(
		platform.trend === 'up' ? TrendingUp : platform.trend === 'down' ? TrendingDown : Minus
	);
	const arrowClass = $derived(
		platform.trend === 'up' ? 'text-success' : platform.trend === 'down' ? 'text-danger' : 'text-text-3'
	);
	const abbr = $derived(platform.label.slice(0, 1).toUpperCase());
</script>

<button
	onclick={() => platform.enters && onenter?.(platform.key)}
	class="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
	disabled={!platform.enters}
>
	<span
		class="grid h-8 w-8 flex-none place-items-center rounded-lg text-xs font-extrabold"
		style="background:{PLATFORM_COLOR[platform.key]}1a;color:{PLATFORM_COLOR[platform.key]}"
	>
		{abbr}
	</span>
	<span class="min-w-0 flex-1">
		<span class="block text-sm font-bold text-text-1">{platform.label}</span>
		<span class="block truncate text-xs text-text-3">{platform.sub}</span>
	</span>
	<!-- Fixed-width score so every row's number ends at the same x. -->
	<span class="w-[58px] flex-none text-right text-base font-extrabold text-text-1">
		{platform.score}<span class="text-xs font-normal text-text-3">{platform.scale}</span>
	</span>
	<!-- Fixed slot for the trend arrow. -->
	<span class="flex w-4 flex-none justify-center {arrowClass}">
		<TrendIcon size={15} strokeWidth={2.5} />
	</span>
	<!-- Fixed slot for the chevron — reserves space even when absent, so rows align. -->
	<span class="flex w-4 flex-none justify-center text-text-3">
		{#if platform.enters}
			<ChevronRight size={16} />
		{/if}
	</span>
</button>
