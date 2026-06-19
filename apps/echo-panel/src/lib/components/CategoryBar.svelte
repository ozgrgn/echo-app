<!--
  CategoryBar — one row of the "Kategori hareketi" list: label, zone-colored bar,
  score, trend arrow. Bar width = score (0–100), color by GPI zone threshold.
-->
<script lang="ts">
	import { ArrowUp, ArrowDown, Minus } from '@lucide/svelte';

	interface Props {
		label: string;
		score: number;
		trend?: number;
	}

	let { label, score, trend = 0 }: Props = $props();

	// Zone thresholds mirror the prototype's col() helper (≥70 green, ≥55 amber).
	const barColor = $derived(
		score >= 70 ? 'var(--color-success)' : score >= 55 ? 'var(--color-warning)' : 'var(--color-danger)'
	);
	const TrendIcon = $derived(trend > 0 ? ArrowUp : trend < 0 ? ArrowDown : Minus);
	const arrowClass = $derived(trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-3');
</script>

<div class="flex items-center gap-3 py-1.5">
	<span class="w-[74px] truncate text-xs font-semibold text-text-1">{label}</span>
	<span class="h-[7px] flex-1 overflow-hidden rounded-full bg-surface-2">
		<span
			class="block h-full rounded-full transition-all duration-500"
			style="width:{Math.min(100, Math.max(0, score))}%;background:{barColor}"
		></span>
	</span>
	<span class="w-8 text-right text-xs font-bold text-text-1">{Math.round(score)}</span>
	<span class="flex w-5 justify-end {arrowClass}"><TrendIcon size={13} strokeWidth={2.5} /></span>
</div>
