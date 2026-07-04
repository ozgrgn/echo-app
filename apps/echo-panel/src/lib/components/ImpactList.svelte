<!--
  ImpactList — "neyi düzeltirsem GPI artar?" (Impact Analysis). Each row is one
  GPI-driving category with its REAL leverage: how many GPI points the hotel would
  gain if that category rose to the target (85), computed by the backend with the
  actual scoring function (counterfactual GPI delta — no fabricated coefficient).
  Sorted highest-leverage first — the fix list. The lift bar is scaled to the top
  item so the ranking reads at a glance.
-->
<script lang="ts">
	import type { ImpactResponse } from '@talkwo/echo-ui';
	import { CATEGORIES } from '@talkwo/echo-core';
	import { TrendingUp } from '@lucide/svelte';

	interface Props {
		impact: ImpactResponse | null;
		/** How many categories to show (rest collapsed). */
		limit?: number;
	}
	let { impact, limit = 6 }: Props = $props();

	const rows = $derived((impact?.categories ?? []).slice(0, limit));
	const maxLift = $derived(Math.max(0.1, ...rows.map((r) => r.liftToTarget)));

	// Prefer the taxonomy label; fall back to the backend-sent label.
	function label(category: string, fallback: string): string {
		return (CATEGORIES as Record<string, { label: string }>)[category]?.label ?? fallback;
	}
	function scoreTone(s: number | null): string {
		if (s == null) return 'text-text-3';
		if (s >= 70) return 'text-success';
		if (s >= 55) return 'text-warning';
		return 'text-danger';
	}
</script>

{#if !impact || rows.length === 0}
	<p class="py-6 text-center text-[13px] text-text-3">
		Kaldıraç hesabı için yeterli veri yok.
	</p>
{:else}
	<div class="mb-2 flex items-center justify-between text-[11px] text-text-3">
		<span>Kategori hedefe (<b class="text-text-2">{impact.target}</b>) çıkarsa GPI kazancı</span>
		<span>GPI <b class="text-text-1">{impact.gpi.toFixed(1)}</b></span>
	</div>
	<ul class="flex flex-col">
		{#each rows as r, i (r.category)}
			<li class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<span class="grid h-5 w-5 flex-none place-items-center rounded-full bg-surface-2 text-[10px] font-extrabold text-text-2">{i + 1}</span>
						<span class="truncate text-[13px] font-semibold text-text-1">{label(r.category, r.label)}</span>
						<span class="text-[11px] {scoreTone(r.aspectScore)}">
							{r.aspectScore != null ? r.aspectScore.toFixed(0) : '—'}
						</span>
						<span class="text-[11px] text-text-3">· {r.mentionCount} mention</span>
					</div>
					<!-- Lift bar, scaled to the top item. -->
					<div class="mt-1.5 ml-7 h-1.5 overflow-hidden rounded-full bg-surface-2">
						<div class="h-full rounded-full bg-brand" style="width:{(r.liftToTarget / maxLift) * 100}%"></div>
					</div>
				</div>
				<div class="flex flex-col items-end">
					<span class="whitespace-nowrap text-[14px] font-extrabold text-brand">
						+{r.liftToTarget.toFixed(1)}
					</span>
					<span class="flex items-center gap-0.5 text-[10px] text-text-3">
						<TrendingUp size={11} strokeWidth={2.5} /> GPI
					</span>
				</div>
			</li>
		{/each}
	</ul>
	{#if impact.underMeasured.length > 0}
		<p class="mt-2 text-[11px] text-text-3">
			Yetersiz veri: {impact.underMeasured.map((u) => label(u.category, u.label)).join(', ')}
		</p>
	{/if}
{/if}
