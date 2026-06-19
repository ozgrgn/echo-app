<!--
  DeltaBadge — a compact ▲/▼ change pill (e.g. "▼ 1.2", "▲ %18", "⚠ kritik").

  Key idea: colour follows MEANING, not raw direction. A falling response rate is
  bad (red) even though it's a "down" arrow; a shrinking competitor gap might be
  good. So callers pass the value plus how to interpret it via `polarity`:
    - 'higher-better' (default): up = good/green, down = bad/red
    - 'lower-better'           : down = good/green, up = bad/red
    - 'auto'                   : neutral grey, arrow only (no good/bad judgement)
  `critical` overrides everything with a warning-styled alert pill.
-->
<script lang="ts">
	interface Props {
		value: number;
		/** Optional unit suffix, e.g. 'pp', '%', '/5'. */
		unit?: string;
		/** '%' prefix style (Turkish "%18"). When true renders %{value}. */
		percentPrefix?: boolean;
		polarity?: 'higher-better' | 'lower-better' | 'auto';
		/** Force the alert look + custom label (e.g. "kritik"). */
		critical?: boolean;
		criticalLabel?: string;
		/** Decimal places for the number. */
		decimals?: number;
	}

	import { ArrowUp, ArrowDown, Minus, TriangleAlert } from '@lucide/svelte';

	let {
		value,
		unit = '',
		percentPrefix = false,
		polarity = 'higher-better',
		critical = false,
		criticalLabel = 'kritik',
		decimals = 1
	}: Props = $props();

	const isUp = $derived(value > 0);
	const isFlat = $derived(value === 0);

	// Map direction → good/bad given the metric's polarity.
	const good = $derived(
		polarity === 'auto' ? null : polarity === 'higher-better' ? isUp : !isUp
	);

	const ArrowIcon = $derived(isFlat ? Minus : isUp ? ArrowUp : ArrowDown);

	const toneClass = $derived(
		critical
			? 'bg-warning-light text-warning'
			: isFlat || good === null
				? 'bg-surface-2 text-text-3'
				: good
					? 'bg-success-light text-success'
					: 'bg-danger-light text-danger'
	);

	const num = $derived(Math.abs(value).toFixed(decimals));
	const label = $derived(
		percentPrefix ? `%${num}` : `${num}${unit}`
	);
</script>

<span
	class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none {toneClass}"
>
	{#if critical}
		<TriangleAlert size={12} strokeWidth={2.5} />{criticalLabel}
	{:else}
		<ArrowIcon size={12} strokeWidth={2.5} />{label}
	{/if}
</span>
