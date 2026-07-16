<!--
  ImpactList — "neyi düzeltirsem GPI artar?" (Impact Analysis). Each row is one
  GPI-driving category with its REAL leverage: how many GPI points the hotel would
  gain if that category rose to the target (85), computed by the backend with the
  actual scoring function (counterfactual GPI delta — no fabricated coefficient).
  Sorted highest-leverage first — the fix list. The lift bar is scaled to the top
  item so the ranking reads at a glance.
-->
<script lang="ts">
	import type { ImpactResponse, NegativeConcentrationRow } from '@talkwo/echo-ui';
	import { CATEGORIES } from '@talkwo/echo-core';
	import { page } from '$app/state';
	import { parseOsWindow } from '$lib/config/window';
	import { TrendingUp, ChevronDown, CircleAlert } from '@lucide/svelte';

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

	// ── Per-category drill-down ("En çok negatif nerede yoğunlaşmış?") ──────────
	// Clicking a category row expands its granular negative-concentration (Pareto,
	// cumulative-50%). Lazy: fetched on first open, then cached per category. Cache is
	// keyed by category only; a window change clears it (the counts are window-scoped).
	let openCategory = $state<string | null>(null);
	let cache = $state<Record<string, NegativeConcentrationRow[]>>({});
	let loadingCategory = $state<string | null>(null);
	let erroredCategory = $state<string | null>(null);

	// Window change invalidates cached counts (they're window-scoped). Reading the param
	// inside the effect subscribes it to the rail's ?window=.
	const win = $derived(parseOsWindow(page.url.searchParams.get('window')));
	$effect(() => {
		void win;
		cache = {};
		openCategory = null;
	});

	async function toggle(category: string) {
		if (openCategory === category) {
			openCategory = null;
			return;
		}
		openCategory = category;
		if (cache[category]) return; // already loaded

		loadingCategory = category;
		erroredCategory = null;
		try {
			const res = await fetch(
				`/api/os/data?resource=impactConcentration&category=${encodeURIComponent(category)}&window=${encodeURIComponent(win)}`
			);
			if (!res.ok) throw new Error('impactConcentration failed');
			const body = await res.json();
			cache = { ...cache, [category]: body.rows ?? [] };
		} catch {
			erroredCategory = category;
		} finally {
			loadingCategory = null;
		}
	}
</script>

{#if !impact || rows.length === 0}
	<p class="py-6 text-center text-[13px] text-text-3">
		Kaldıraç hesabı için yeterli veri yok.
	</p>
{:else}
	<div class="mb-2 flex items-center justify-between text-[11px] text-text-3">
		<span>Kategori hedefe (<b class="text-text-2">{impact.target}</b>) çıkarsa GPI kazancı</span>
		<!-- The bare "GPI 69.1" here was the pure-aspect leverage BASE (computeOverallGpi),
		     a different scale from the dashboard's star-anchored GPI. Showing it next to the
		     dashboard number confused operators (same venue, two GPIs). Removed from the UI;
		     impact.gpi still ships in the API response (liftToTarget is relative to it). -->
	</div>
	<ul class="flex flex-col">
		{#each rows as r, i (r.category)}
			{@const isOpen = openCategory === r.category}
			<li class="border-t border-surface-2 first:border-t-0">
				<!-- Whole row is the accordion toggle: click a category to reveal where its
				     negatives concentrate (granular Pareto drill-down). -->
				<button
					type="button"
					onclick={() => toggle(r.category)}
					class="grid w-full grid-cols-[1fr_auto] items-center gap-3 py-2.5 text-left transition-colors hover:bg-surface-2/40"
					aria-expanded={isOpen}
				>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="grid h-5 w-5 flex-none place-items-center rounded-full bg-surface-2 text-[10px] font-extrabold text-text-2">{i + 1}</span>
							<span class="truncate text-[13px] font-semibold text-text-1">{label(r.category, r.label)}</span>
							<span class="text-[11px] {scoreTone(r.aspectScore)}">
								{r.aspectScore != null ? r.aspectScore.toFixed(0) : '—'}
							</span>
							<span class="text-[11px] text-text-3">· {r.mentionCount} mention</span>
							<ChevronDown
								size={13}
								strokeWidth={2.5}
								class="flex-none text-text-3 transition-transform {isOpen ? 'rotate-180' : ''}"
							/>
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
				</button>

				<!-- Expanded drill-down: granular keys covering ≥50% of this category's
				     negatives, ranked by negative volume (tie-break ratio). -->
				{#if isOpen}
					<div class="ml-7 mb-2.5 rounded-lg bg-surface-2/50 p-3">
						{#if loadingCategory === r.category}
							<p class="py-2 text-center text-[12px] text-text-3">Yükleniyor…</p>
						{:else if erroredCategory === r.category}
							<p class="py-2 text-center text-[12px] text-text-3">Veri alınamadı — tekrar deneyin.</p>
						{:else if (cache[r.category]?.length ?? 0) === 0}
							<p class="py-2 text-center text-[12px] text-text-3">Bu kategoride belirgin negatif yoğunlaşma yok.</p>
						{:else}
							{@const conc = cache[r.category]}
							{@const coverage = conc[conc.length - 1]?.cumulativeShare ?? 0}
							<div class="mb-2 flex items-center gap-1.5 text-[11px] text-text-3">
								<CircleAlert size={12} strokeWidth={2.5} class="text-danger" />
								<span>Negatifin ~%{Math.round(coverage * 100)}’i şu {conc.length} başlıkta:</span>
							</div>
							<ul class="flex flex-col gap-2">
								{#each conc as c (c.granular_key)}
									<li>
										<div class="mb-1 flex items-center justify-between gap-3">
											<span class="min-w-0 truncate text-[12.5px] font-semibold text-text-1">{c.granular_label}</span>
											<span class="shrink-0 text-[11.5px] text-text-2">
												<b class="text-danger">{c.negativeCount}</b>
												<span class="text-text-3">/ {c.totalCount}</span>
												<span class="ml-1 text-text-3">· %{Math.round(c.negativeRatio * 100)}</span>
											</span>
										</div>
										<!-- Bar = this key's SHARE of the category's negatives (what the 50% cut ranks). -->
										<div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-1">
											<div class="h-full rounded-full bg-danger" style="width:{Math.round(c.shareOfNegatives * 100)}%"></div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	{#if impact.underMeasured.length > 0}
		<p class="mt-2 text-[11px] text-text-3">
			Yetersiz veri: {impact.underMeasured.map((u) => label(u.category, u.label)).join(', ')}
		</p>
	{/if}
{/if}
