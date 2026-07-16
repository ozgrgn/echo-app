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

<!--
  CSS grid so every column sits on shared vertical guides across all rows.
  Tracks: label (74px) · ratio bar (elastic 1fr) · percent (40px) · counts (72px) · arrow (20px).
  Only the ratio bar flexes; the four fixed tracks keep %/counts/arrow aligned down every row.
-->
<div class="grid items-center gap-3 py-1.5" style="grid-template-columns: 74px 1fr 40px 72px 20px;">
	<span class="truncate text-xs font-semibold text-text-1">{label}</span>

	<!-- Split ratio bar: green (positive) then red (negative), sharing one track. -->
	<span class="flex h-[7px] overflow-hidden rounded-full bg-surface-2">
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
	<span class="text-center text-xs font-bold tabular-nums {total > 0 ? 'text-text-1' : 'text-text-3'}">
		{total > 0 ? `%${Math.round(posPct)}` : '—'}
	</span>

	<!-- Raw counts pos · neg. Inner 3-track grid (pos | · | neg) locks the centre dot
	     onto one vertical line across every row, regardless of digit count (494·22 and
	     7·10 line up on the ·). -->
	<span class="grid items-center text-xs font-bold tabular-nums" style="grid-template-columns: 1fr auto 1fr">
		<span class="text-right text-success">{pos}</span>
		<span class="px-1 text-text-3">·</span>
		<span class="text-left text-danger">{neg}</span>
	</span>

	<span class="flex justify-end {arrowClass}"><TrendIcon size={13} strokeWidth={2.5} /></span>
</div>
