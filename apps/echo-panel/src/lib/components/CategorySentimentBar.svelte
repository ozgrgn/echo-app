<!--
  CategorySentimentBar — one row of the "Kategori hareketi" list in its sentiment
  variant: label, a split green/red ratio bar (positive vs negative share), the raw
  counts, and the 30-day trend arrow. Replaces the single-score CategoryBar on /os
  behind the CATEGORY_MOVEMENT_SENTIMENT flag. The bar shows SHARE (pos/(pos+neg)),
  not volume — a category with 142/31 reads mostly-green at a glance; the counts
  beside it carry the volume. When a category has zero pos+neg mentions the bar is
  left empty (neutral track) rather than faking a 50/50 split.
-->
<script lang="ts">
	import { ArrowUp, ArrowDown, Minus } from '@lucide/svelte';

	interface Props {
		label: string;
		pos: number;
		neg: number;
		trend?: number;
	}

	let { label, pos, neg, trend = 0 }: Props = $props();

	const total = $derived(pos + neg);
	// Positive share drives the green segment width; the red fills the rest.
	const posPct = $derived(total > 0 ? (pos / total) * 100 : 0);
	const TrendIcon = $derived(trend > 0 ? ArrowUp : trend < 0 ? ArrowDown : Minus);
	const arrowClass = $derived(trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-3');
</script>

<div class="flex items-center gap-3 py-1.5">
	<span class="w-[74px] truncate text-xs font-semibold text-text-1">{label}</span>

	<!-- Split ratio bar: green (positive) then red (negative), sharing one track. -->
	<span class="flex h-[7px] flex-1 overflow-hidden rounded-full bg-surface-2">
		<span
			class="block h-full transition-all duration-500"
			style="width:{posPct}%;background:var(--color-success)"
		></span>
		<span
			class="block h-full transition-all duration-500"
			style="width:{100 - posPct}%;background:var(--color-danger)"
		></span>
	</span>

	<!-- Positive share as a % — the "how satisfied" number the bar visualizes; muted when
	     there are no scored mentions (nothing to divide). Centred in its box so the spacing to
	     the bar and to the counts reads even. -->
	<span class="w-10 text-center text-xs font-bold tabular-nums {total > 0 ? 'text-text-1' : 'text-text-3'}">
		{total > 0 ? `%${Math.round(posPct)}` : '—'}
	</span>

	<!-- Raw counts pos · neg — aligned on the centre dot so it sits on one vertical line
	     across every row (pos right-aligned, neg left-aligned, dot fixed), regardless of digit
	     count (494·22 vs 7·10 line up on the ·). -->
	<span class="flex w-[80px] items-center pl-2 text-xs font-bold tabular-nums">
		<span class="flex-1 text-right text-success">{pos}</span>
		<span class="px-1 text-text-3">·</span>
		<span class="flex-1 text-left text-danger">{neg}</span>
	</span>

	<span class="flex w-5 justify-end {arrowClass}"><TrendIcon size={13} strokeWidth={2.5} /></span>
</div>
