<script lang="ts">
	import { CATEGORIES, gpiZone, getSubcategoryLabel, type CategoryKey } from '@talkwo/echo-core';
	import { goto } from '$app/navigation';
	import PolarityHistogram from '$lib/components/PolarityHistogram.svelte';

	let { data } = $props();

	// ── Sort + filter state ──
	type SortKey = 'gpi_desc' | 'gpi_asc' | 'trend_desc' | 'trend_asc' | 'reviews_desc' | 'department';
	let sortKey = $state<SortKey>('gpi_desc');
	let attentionOnly = $state(false);

	const sortOptions: { value: SortKey; label: string }[] = [
		{ value: 'gpi_desc', label: 'GPI (yüksek → düşük)' },
		{ value: 'gpi_asc', label: 'GPI (düşük → yüksek)' },
		{ value: 'trend_desc', label: 'Trend (artış → azalış)' },
		{ value: 'trend_asc', label: 'Trend (azalış → artış)' },
		{ value: 'reviews_desc', label: 'Yorum sayısı (çok → az)' },
		{ value: 'department', label: 'Departman (A → Z)' }
	];

	const filteredSorted = $derived.by(() => {
		let list = [...data.hotelScore.categoryScores];
		if (attentionOnly) {
			list = list.filter((cs) => cs.headlineScore < 80);
		}
		switch (sortKey) {
			case 'gpi_desc':
				list.sort((a, b) => b.headlineScore - a.headlineScore);
				break;
			case 'gpi_asc':
				list.sort((a, b) => a.headlineScore - b.headlineScore);
				break;
			case 'trend_desc':
				list.sort((a, b) => b.trend - a.trend);
				break;
			case 'trend_asc':
				list.sort((a, b) => a.trend - b.trend);
				break;
			case 'reviews_desc':
				list.sort((a, b) => b.reviewCount - a.reviewCount);
				break;
			case 'department':
				list.sort((a, b) =>
					CATEGORIES[a.category].primaryOwner.localeCompare(CATEGORIES[b.category].primaryOwner, 'tr')
				);
				break;
		}
		return list;
	});

	const attentionCount = $derived(
		data.hotelScore.categoryScores.filter((cs) => cs.headlineScore < 80).length
	);

	// ── Style helpers ──
	function zoneClass(gpi: number): string {
		const z = gpiZone(gpi);
		return z === 'green' ? 'text-success' : z === 'yellow' ? 'text-warning' : 'text-danger';
	}
	function zoneBorderClass(gpi: number): string {
		const z = gpiZone(gpi);
		return z === 'green'
			? 'border-l-success'
			: z === 'yellow'
				? 'border-l-warning'
				: 'border-l-danger';
	}
	function trendClass(t: number): string {
		return t > 0 ? 'text-success' : t < 0 ? 'text-danger' : 'text-text-3';
	}
	function trendIcon(t: number): string {
		return t > 0 ? '▲' : t < 0 ? '▼' : '—';
	}
	function fmtTrend(t: number): string {
		const sign = t > 0 ? '+' : '';
		return `${sign}${t.toFixed(1)}`;
	}
	function subcategoryLabel(subcat: string): string {
		return getSubcategoryLabel(subcat);
	}
	function navTo(category: CategoryKey) {
		goto(`/categories/${category.toLowerCase()}`);
	}
</script>

<div class="space-y-6">
	<!-- ── Header + filters ─────────────────────────────────────────────── -->
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-sm text-text-2">
				{filteredSorted.length} kategori ·
				<span class="font-mono">{data.hotelScore.headlineScore.toFixed(1)}</span> ortalama GPI ·
				<span class="font-mono">{data.hotelScore.reviewCount.toLocaleString('tr-TR')}</span> yorum
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<label
				class="flex items-center gap-2 text-sm cursor-pointer select-none rounded-md border border-border bg-surface-1 px-3 py-1.5 hover:bg-surface-2 has-[:checked]:border-warning has-[:checked]:bg-warning-light"
			>
				<input
					type="checkbox"
					bind:checked={attentionOnly}
					class="rounded text-warning focus:ring-warning"
				/>
				<span>Sadece dikkat gereken</span>
				{#if attentionCount > 0}
					<span
						class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold {attentionOnly
							? 'bg-warning text-white'
							: 'bg-warning-light text-warning'}"
					>
						{attentionCount}
					</span>
				{/if}
			</label>

			<select
				bind:value={sortKey}
				class="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
			>
				{#each sortOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
	</header>

	<!-- ── Empty state ──────────────────────────────────────────────────── -->
	{#if filteredSorted.length === 0}
		<div
			class="bg-surface-1 border border-border rounded-lg p-12 text-center text-text-2"
		>
			<div class="text-4xl mb-3">✨</div>
			<div class="text-base font-medium text-text-1 mb-1">Harika! Dikkat gereken kategori yok.</div>
			<div class="text-sm">Tüm kategorilerinizin GPI'si 80'in üzerinde.</div>
			<button
				onclick={() => (attentionOnly = false)}
				class="mt-4 text-sm text-brand hover:underline"
			>
				Tümünü göster →
			</button>
		</div>
	{:else}
		<!-- ── Category grid ─────────────────────────────────────────────── -->
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
			{#each filteredSorted as cs (cs.category)}
				{@const meta = CATEGORIES[cs.category]}
				<button
					type="button"
					class="text-left bg-surface-1 border border-border rounded-lg p-5 border-l-4 {zoneBorderClass(
						cs.headlineScore
					)} shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer group focus:outline-none focus:ring-2 focus:ring-brand/30"
					onclick={() => navTo(cs.category)}
				>
					<!-- Header -->
					<header class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<h3 class="text-base font-semibold text-text-1 group-hover:text-brand transition-colors">
								{meta.label}
							</h3>
							<p class="text-xs text-text-3 mt-0.5 truncate">
								Sorumlu: <span class="text-text-2">{meta.primaryOwner}</span>
							</p>
						</div>
						<div class="text-right shrink-0">
							<div class="text-3xl font-bold {zoneClass(cs.headlineScore)}">
								{cs.headlineScore.toFixed(1)}
							</div>
							<div class="text-xs text-text-3">×{(meta.weight * 100).toFixed(0)}% ağırlık</div>
						</div>
					</header>

					<!-- Sentiment distribution (5-bucket polarity) -->
					<PolarityHistogram distribution={cs.distribution} variant="diverging" showCounts />

					<!-- Trend + count row -->
					<div class="flex items-center justify-between text-sm">
						<span class={trendClass(cs.trend)}>
							<span class="font-bold">{trendIcon(cs.trend)} {fmtTrend(cs.trend)}</span>
							<span class="text-text-3 text-xs ml-1">vs geçen ay</span>
						</span>
						<span class="text-text-2 text-sm">
							<span class="font-semibold">{cs.reviewCount}</span>
							<span class="text-text-3 text-xs">yorum</span>
						</span>
					</div>

					<!-- Top issues preview (max 2) -->
					{#if cs.topIssues.length > 0}
						<div class="border-t border-border pt-3 space-y-1.5">
							<div class="text-xs text-text-3 uppercase tracking-wider mb-1">
								Öne çıkan sorunlar
							</div>
							{#each cs.topIssues.slice(0, 2) as issue (issue.subcategory)}
								<div class="flex items-center gap-2 text-xs">
									<span class="w-1.5 h-1.5 rounded-full bg-danger shrink-0"></span>
									<span class="text-text-2 capitalize truncate">
										{subcategoryLabel(issue.subcategory)}
									</span>
									<span class="ml-auto text-text-3 font-mono">×{issue.count}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Drill-down hint -->
					<div
						class="flex items-center justify-end text-xs text-text-3 group-hover:text-brand transition-colors mt-auto"
					>
						Detaylara git →
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
