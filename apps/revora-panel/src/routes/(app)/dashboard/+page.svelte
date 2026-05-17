<script lang="ts">
	import { CATEGORIES, gpiZone, rpiLabel, type CategoryScore, type TopIssue } from '@revora/review-core';

	let { data } = $props();

	// ── Derived KPI helpers ──
	const overallZone = $derived(gpiZone(data.hotelScore.gpi));
	const rpiText = $derived(data.hotelScore.rpi !== null ? rpiLabel(data.hotelScore.rpi) : '—');
	const avgRating = $derived(deriveAvgRating(data.hotelScore.gpi)); // Phase 1 placeholder

	function deriveAvgRating(gpi: number): number {
		// Rough conversion until backend provides this in HotelScore.
		// 100 GPI ≈ 5★, 60 GPI ≈ 3★
		return Math.min(5, Math.max(1, 1 + (gpi / 100) * 4));
	}

	// Top issues + praises across ALL categories, sorted by count desc
	const allTopIssues = $derived(
		data.hotelScore.categoryScores.flatMap((cs) =>
			cs.topIssues.map((issue) => ({ ...issue, category: cs.category }))
		).sort((a, b) => b.count - a.count).slice(0, 6)
	);

	const allTopPraises = $derived(
		data.hotelScore.categoryScores.flatMap((cs) =>
			cs.topPraises.map((praise) => ({ ...praise, category: cs.category }))
		).sort((a, b) => b.count - a.count).slice(0, 6)
	);

	// ── Color helpers ──
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

	function zoneBgClass(gpi: number): string {
		const z = gpiZone(gpi);
		return z === 'green'
			? 'bg-success-light text-success'
			: z === 'yellow'
				? 'bg-warning-light text-warning'
				: 'bg-danger-light text-danger';
	}

	function trendClass(trend: number): string {
		return trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-3';
	}

	function fmtTrend(trend: number): string {
		const sign = trend > 0 ? '+' : '';
		return `${sign}${trend.toFixed(1)}`;
	}

	function subcategoryLabel(subcat: string): string {
		return subcat.replace(/_/g, ' ');
	}
</script>

<div class="space-y-6">
	<!-- ── KPI Row ─────────────────────────────────────────────────────── -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- GPI -->
		<div
			class="bg-surface-1 border border-border rounded-lg p-5 border-l-4 {zoneBorderClass(
				data.hotelScore.gpi
			)} shadow-sm"
		>
			<div class="text-xs text-text-2 uppercase tracking-wider mb-1">Genel GPI</div>
			<div class="text-3xl font-bold {zoneClass(data.hotelScore.gpi)}">
				{data.hotelScore.gpi.toFixed(1)}
			</div>
			<div class="text-xs text-text-3 mt-1">
				{overallZone === 'green' ? 'Mükemmel' : overallZone === 'yellow' ? 'İyi' : 'Düşük'}
			</div>
		</div>

		<!-- RPI -->
		<div class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<div class="text-xs text-text-2 uppercase tracking-wider mb-1">RPI (Rakip Karşılaştırma)</div>
			<div class="text-3xl font-bold text-text-1">
				{data.hotelScore.rpi?.toFixed(1) ?? '—'}
			</div>
			<div class="text-xs text-text-3 mt-1">
				{rpiText} · {data.competitors.length} rakip
			</div>
		</div>

		<!-- Review Count -->
		<div class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<div class="text-xs text-text-2 uppercase tracking-wider mb-1">Toplam Yorum</div>
			<div class="text-3xl font-bold text-text-1">
				{data.hotelScore.reviewCount.toLocaleString('tr-TR')}
			</div>
			<div class="text-xs text-text-3 mt-1">
				{data.period} dönemi
			</div>
		</div>

		<!-- Avg Rating -->
		<div class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<div class="text-xs text-text-2 uppercase tracking-wider mb-1">Ortalama Puan</div>
			<div class="text-3xl font-bold text-text-1">
				{avgRating.toFixed(1)} <span class="text-warning text-2xl">★</span>
			</div>
			<div class="text-xs text-text-3 mt-1">GPI'den türetildi</div>
		</div>
	</div>

	<!-- ── Category Grid ───────────────────────────────────────────────── -->
	<section>
		<h2 class="text-lg font-semibold text-text-1 mb-4">Kategoriler</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
			{#each data.hotelScore.categoryScores as cs (cs.category)}
				{@const meta = CATEGORIES[cs.category]}
				<article
					class="bg-surface-1 border border-border rounded-lg p-4 border-l-4 {zoneBorderClass(
						cs.gpi
					)} shadow-sm flex flex-col gap-2"
				>
					<header class="flex items-center justify-between">
						<span class="text-sm font-semibold text-text-1">{meta.label}</span>
						<span class="text-xl font-bold {zoneClass(cs.gpi)}">{cs.gpi.toFixed(1)}</span>
					</header>

					<!-- Mini bar -->
					<div class="h-1.5 rounded-full bg-surface-2 overflow-hidden">
						<div
							class="h-full rounded-full transition-all duration-500"
							class:bg-success={gpiZone(cs.gpi) === 'green'}
							class:bg-warning={gpiZone(cs.gpi) === 'yellow'}
							class:bg-danger={gpiZone(cs.gpi) === 'red'}
							style="width: {Math.min(100, Math.max(0, cs.gpi))}%"
						></div>
					</div>

					<div class="flex items-center justify-between text-xs">
						<span class={trendClass(cs.trend)}>
							{fmtTrend(cs.trend)} <span class="text-text-3">vs geçen ay</span>
						</span>
						<span class="text-text-3">{cs.reviewCount} yorum</span>
					</div>

					{#if cs.topIssues.length > 0}
						<ul class="mt-1 space-y-1 text-xs border-t border-border pt-2">
							{#each cs.topIssues.slice(0, 2) as issue (issue.subcategory)}
								<li class="flex items-center gap-1.5">
									<span class="w-1.5 h-1.5 rounded-full bg-danger shrink-0"></span>
									<span class="text-text-2 truncate">{subcategoryLabel(issue.subcategory)}</span>
									<span class="ml-auto text-text-3 font-mono">×{issue.count}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<!-- ── Top Issues + Top Praises ───────────────────────────────────── -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<h3 class="text-base font-semibold text-text-1 mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-danger"></span>
				En Çok Bahsedilen Sorunlar
			</h3>
			{#if allTopIssues.length === 0}
				<p class="text-sm text-text-3">Bu dönemde belirgin bir sorun yok.</p>
			{:else}
				<ul class="divide-y divide-border">
					{#each allTopIssues as issue (`${issue.category}-${issue.subcategory}`)}
						{@const catLabel = CATEGORIES[issue.category].label}
						<li class="py-2.5 flex items-start gap-3">
							<span
								class="px-2 py-0.5 rounded-md text-xs font-medium {zoneBgClass(0)} shrink-0"
							>
								{catLabel}
							</span>
							<div class="flex-1 min-w-0">
								<div class="text-sm text-text-1 font-medium">
									{subcategoryLabel(issue.subcategory)}
								</div>
								<div class="text-xs text-text-3 truncate italic">"{issue.sampleExcerpt}"</div>
							</div>
							<span class="text-sm font-bold text-danger shrink-0">×{issue.count}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<h3 class="text-base font-semibold text-text-1 mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-success"></span>
				En Çok Övülenler
			</h3>
			{#if allTopPraises.length === 0}
				<p class="text-sm text-text-3">Bu dönemde belirgin bir övgü yok.</p>
			{:else}
				<ul class="divide-y divide-border">
					{#each allTopPraises as praise (`${praise.category}-${praise.subcategory}`)}
						{@const catLabel = CATEGORIES[praise.category].label}
						<li class="py-2.5 flex items-start gap-3">
							<span
								class="px-2 py-0.5 rounded-md text-xs font-medium bg-success-light text-success shrink-0"
							>
								{catLabel}
							</span>
							<div class="flex-1 min-w-0">
								<div class="text-sm text-text-1 font-medium">
									{subcategoryLabel(praise.subcategory)}
								</div>
								<div class="text-xs text-text-3 truncate italic">"{praise.sampleExcerpt}"</div>
							</div>
							<span class="text-sm font-bold text-success shrink-0">×{praise.count}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- Footer note -->
	<footer class="text-xs text-text-3 text-center pt-2">
		Mock veri · Phase 2'de gerçek API'ye bağlanacak · Son güncelleme: {new Date(
			data.hotelScore.updatedAt
		).toLocaleString('tr-TR')}
	</footer>
</div>
