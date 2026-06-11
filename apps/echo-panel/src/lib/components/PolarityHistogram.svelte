<!--
  PolarityHistogram — 5-bucket sentiment distribution visualizer.

  Two variants:
    - "bars" (default): vertical histogram, like ReviewPro/TrustYou dashboards.
      Best for category drill-downs where there's vertical space.
    - "diverging": single horizontal bar split at the neutral center.
      Best for compact list/card views where space is tight.

  The component is purely presentational — it reads a SentimentDistribution
  and renders. It does no scoring, no bucketing — that's already done.
-->
<script lang="ts">
	import type { SentimentDistribution } from '@talkwo/echo-core';

	interface Props {
		distribution: SentimentDistribution;
		variant?: 'bars' | 'diverging';
		showLabels?: boolean;
		showCounts?: boolean;
		height?: number; // px — for bars variant
	}

	let {
		distribution,
		variant = 'bars',
		showLabels = true,
		showCounts = true,
		height = 80
	}: Props = $props();

	const total = $derived(
		distribution.strongNegativeCount +
			distribution.negativeCount +
			distribution.neutralCount +
			distribution.positiveCount +
			distribution.strongPositiveCount
	);

	// Bucket meta — order matters for both variants (left → right = negative → positive).
	const buckets = $derived([
		{
			key: 'strong_negative',
			label: 'Çok Olumsuz',
			short: '−−',
			count: distribution.strongNegativeCount,
			color: 'bg-danger',
			textColor: 'text-danger'
		},
		{
			key: 'negative',
			label: 'Olumsuz',
			short: '−',
			count: distribution.negativeCount,
			color: 'bg-danger/60',
			textColor: 'text-danger'
		},
		{
			key: 'neutral',
			label: 'Nötr',
			short: '0',
			count: distribution.neutralCount,
			color: 'bg-text-3/40',
			textColor: 'text-text-3'
		},
		{
			key: 'positive',
			label: 'Olumlu',
			short: '+',
			count: distribution.positiveCount,
			color: 'bg-success/60',
			textColor: 'text-success'
		},
		{
			key: 'strong_positive',
			label: 'Çok Olumlu',
			short: '++',
			count: distribution.strongPositiveCount,
			color: 'bg-success',
			textColor: 'text-success'
		}
	]);

	const maxCount = $derived(Math.max(...buckets.map((b) => b.count), 1));

	function pct(count: number) {
		return total === 0 ? 0 : (count / total) * 100;
	}
</script>

{#if variant === 'bars'}
	<!-- ── Vertical histogram (5 bars side by side) ───────────────────────── -->
	<div class="w-full" aria-label="Polarity distribution">
		<div class="flex items-end gap-1.5" style:height="{height}px">
			{#each buckets as b}
				{@const barHeight = b.count === 0 ? 2 : (b.count / maxCount) * height}
				<div class="flex-1 flex flex-col items-center justify-end gap-1">
					{#if showCounts}
						<span class="text-[10px] font-medium {b.textColor} leading-none">
							{b.count}
						</span>
					{/if}
					<div
						class="w-full {b.color} rounded-t-sm transition-all duration-500"
						style:height="{barHeight}px"
						title="{b.label}: {b.count} ({pct(b.count).toFixed(1)}%)"
					></div>
				</div>
			{/each}
		</div>
		{#if showLabels}
			<div class="flex gap-1.5 mt-1">
				{#each buckets as b}
					<span class="flex-1 text-center text-[10px] {b.textColor}/70">
						{b.short}
					</span>
				{/each}
			</div>
		{/if}
		{#if distribution.meanPolarity !== undefined && total > 0}
			<div class="mt-2 text-xs text-text-2">
				Ortalama duygu:
				<span
					class="font-semibold"
					class:text-success={distribution.meanPolarity > 0.2}
					class:text-danger={distribution.meanPolarity < -0.2}
					class:text-text-2={distribution.meanPolarity >= -0.2 && distribution.meanPolarity <= 0.2}
				>
					{distribution.meanPolarity > 0 ? '+' : ''}{distribution.meanPolarity.toFixed(2)}
				</span>
				<span class="text-text-3">({total} ifade)</span>
			</div>
		{/if}
	</div>
{:else}
	<!-- ── Diverging horizontal bar (compact) ─────────────────────────────── -->
	<div class="w-full" aria-label="Polarity distribution">
		<div class="flex w-full h-2 rounded-full overflow-hidden bg-surface-2">
			{#each buckets as b}
				<div
					class={b.color}
					style:width="{pct(b.count)}%"
					title="{b.label}: {b.count} ({pct(b.count).toFixed(1)}%)"
				></div>
			{/each}
		</div>
		{#if showCounts}
			<div class="flex justify-between text-[10px] text-text-3 mt-1">
				<span class="text-danger font-medium">
					{distribution.strongNegativeCount + distribution.negativeCount} olumsuz
				</span>
				<span>{distribution.neutralCount} nötr</span>
				<span class="text-success font-medium">
					{distribution.positiveCount + distribution.strongPositiveCount} olumlu
				</span>
			</div>
		{/if}
	</div>
{/if}
