<!--
  StatTile — one KPI: label · big value · delta badge · sparkline · sub-context.
  Composes Card + DeltaBadge + Sparkline so every KPI shares one layout and the
  dashboard stops re-typing tile markup inline.

  `emphasis="primary"` makes the hero metric (Genel GPI) read louder than the rest:
  larger value + raised elevation. The secondary tiles stay calm so the eye lands
  on the headline first — that hierarchy is what the flat version was missing.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import DeltaBadge from './DeltaBadge.svelte';
	import Sparkline from './Sparkline.svelte';

	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

	interface Props {
		label: string;
		/** Already-formatted display value, e.g. "70.6", "%0", "196", "−3.4". */
		value: string;
		tone?: Tone;
		emphasis?: 'primary' | 'secondary';
		/** Caption under the value (e.g. "hedef 75", "rakip endeksi"). */
		caption?: string;
		/** Delta — pass undefined to hide the badge. */
		delta?: number;
		deltaUnit?: string;
		deltaPercentPrefix?: boolean;
		deltaPolarity?: 'higher-better' | 'lower-better' | 'auto';
		critical?: boolean;
		criticalLabel?: string;
		/** Sparkline series (oldest → newest). */
		trend?: number[];
		/** Smallest y-range the sparkline may cover — see Sparkline's minSpan. Pass it for
		 *  metrics whose meaningful moves are small relative to their value (GPI ≈ 2). */
		trendMinSpan?: number;
		/** When set (0–5), draws a 5-star rating row under the value with partial fill on the
		 *  last star (e.g. 4.6 → 4 full + 60% of the 5th). For star KPIs like the OTA rating. */
		stars?: number;
		/** href makes the whole tile a link. */
		href?: string;
		title?: string;
	}

	let {
		label,
		value,
		tone = 'neutral',
		emphasis = 'secondary',
		caption,
		delta,
		deltaUnit = '',
		deltaPercentPrefix = false,
		deltaPolarity = 'higher-better',
		critical = false,
		criticalLabel = 'kritik',
		trend,
		trendMinSpan,
		stars,
		href,
		title
	}: Props = $props();

	const isPrimary = $derived(emphasis === 'primary');

	// Per-star fill fraction (0–1) for a 5-star row: star i is full if stars ≥ i+1,
	// empty if stars ≤ i, else the fractional remainder (e.g. 4.6 → 5th star = 0.6).
	const starFills = $derived(
		stars == null
			? []
			: Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, stars - i)))
	);

	// Value colour tracks tone; primary GPI gets the boldest weight.
	const valueColor: Record<Tone, string> = {
		neutral: 'text-text-1',
		success: 'text-success',
		warning: 'text-warning',
		danger: 'text-danger',
		brand: 'text-brand'
	};

	const sparkColor: Record<Tone, string> = {
		neutral: 'var(--color-brand)',
		success: 'var(--color-success)',
		warning: 'var(--color-warning)',
		danger: 'var(--color-danger)',
		brand: 'var(--color-brand)'
	};
</script>

<Card
	{tone}
	as={href ? 'a' : 'div'}
	{href}
	{title}
	interactive={!!href}
	padding="md"
	class="flex h-full min-h-[124px] flex-col {isPrimary ? 'shadow-raised' : ''}"
>
	<div class="flex items-start justify-between gap-2">
		<span class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-3">{label}</span>
		{#if critical}
			<DeltaBadge value={0} critical {criticalLabel} />
		{:else if delta !== undefined}
			<DeltaBadge
				value={delta}
				unit={deltaUnit}
				percentPrefix={deltaPercentPrefix}
				polarity={deltaPolarity}
			/>
		{/if}
	</div>

	<div class="mt-2.5 flex items-baseline gap-2 {valueColor[tone]}">
		<span class="font-extrabold tabular-nums leading-none tracking-tight {isPrimary ? 'text-[34px]' : 'text-[27px]'}">
			{value}
		</span>
	</div>

	{#if starFills.length > 0}
		<!-- 5-star row with partial fill on the last star (OTA rating). The gold fill sits on
		     a muted base so an empty star still reads as a star, and the pride signal is the
		     row of gold — the number alone doesn't celebrate the way stars do. -->
		<div class="mt-1.5 flex gap-0.5" aria-hidden="true">
			{#each starFills as fill, i (i)}
				<svg viewBox="0 0 20 20" class="h-3.5 w-3.5">
					<defs>
						<linearGradient id="starfill-{i}-{fill}">
							<stop offset="{fill * 100}%" stop-color="#f5a623" />
							<stop offset="{fill * 100}%" stop-color="var(--color-border, #e2e2e2)" />
						</linearGradient>
					</defs>
					<path
						d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 15.5l-5.2 2.72.99-5.8-4.21-4.1 5.82-.85z"
						fill="url(#starfill-{i}-{fill})"
					/>
				</svg>
			{/each}
		</div>
	{/if}

	{#if caption}
		<div class="mt-1.5 text-[10.5px] text-text-3">{caption}</div>
	{/if}

	{#if trend && trend.length >= 2}
		<div class="mt-auto pt-3">
			<Sparkline data={trend} color={sparkColor[tone]} width={220} height={30} fill={!isPrimary ? false : true} minSpan={trendMinSpan} />
		</div>
	{/if}
</Card>
