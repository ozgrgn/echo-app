<script lang="ts">
	import {
		CATEGORIES,
		gpiZone,
		type Review,
		type Sentiment
	} from '@revora/review-core';
	import ReviewDetailModal from '$lib/components/ReviewDetailModal.svelte';

	let { data } = $props();

	const meta = $derived(CATEGORIES[data.categoryKey]);
	const zone = $derived(gpiZone(data.categoryScore.gpi));

	// ── Subcategory breakdown ──
	// Aggregate sentiment counts per subcategory across all reviews for this
	// category. In production this comes from the backend; mock derives it.
	type SubAgg = { subcategory: string; positive: number; negative: number; neutral: number };
	const subBreakdown = $derived.by<SubAgg[]>(() => {
		const map = new Map<string, SubAgg>();
		for (const r of data.reviews) {
			for (const s of r.sentiments) {
				if (s.category !== data.categoryKey) continue;
				const agg = map.get(s.subcategory) ?? {
					subcategory: s.subcategory,
					positive: 0,
					negative: 0,
					neutral: 0
				};
				if (s.sentiment === 'positive') agg.positive++;
				else if (s.sentiment === 'negative') agg.negative++;
				else if (s.sentiment === 'neutral') agg.neutral++;
				else if (s.sentiment === 'mixed') {
					agg.positive += 0.5;
					agg.negative += 0.5;
				}
				map.set(s.subcategory, agg);
			}
		}
		// Seed-list: any subcategory declared on the category but missing in
		// reviews should still show with zero counts
		for (const sub of meta.subcategories) {
			if (!map.has(sub)) {
				map.set(sub, { subcategory: sub, positive: 0, negative: 0, neutral: 0 });
			}
		}
		// Sort by total volume desc
		return Array.from(map.values()).sort(
			(a, b) => b.positive + b.negative + b.neutral - (a.positive + a.negative + a.neutral)
		);
	});

	function subcategoryLabel(subcat: string): string {
		return subcat.replace(/_/g, ' ');
	}
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

	// ── Review feed filters ──
	let subcatFilter = $state<string | null>(null);
	let sentimentFilter = $state<Sentiment | 'all'>('all');

	const filteredReviews = $derived.by(() => {
		return data.reviews.filter((r) => {
			return r.sentiments.some((s) => {
				if (s.category !== data.categoryKey) return false;
				if (subcatFilter && s.subcategory !== subcatFilter) return false;
				if (sentimentFilter !== 'all' && s.sentiment !== sentimentFilter) return false;
				return true;
			});
		});
	});

	// ── Modal state ──
	let modalOpen = $state(false);
	let modalReview = $state<Review | null>(null);

	function openModal(review: Review) {
		modalReview = review;
		modalOpen = true;
	}

	// ── Donut math for GPI gauge ──
	const gaugeSize = 160;
	const gaugeR = gaugeSize / 2 - 12;
	const gaugeC = 2 * Math.PI * gaugeR;
	const gaugeOffset = $derived(gaugeC * (1 - Math.min(100, Math.max(0, data.categoryScore.gpi)) / 100));
	const gaugeColor = $derived(
		zone === 'green'
			? 'var(--color-success)'
			: zone === 'yellow'
				? 'var(--color-warning)'
				: 'var(--color-danger)'
	);

	function stars(rating: number): string {
		return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
	}
	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="text-sm text-text-2 flex items-center gap-2">
		<a href="/categories" class="hover:text-brand transition-colors">Kategoriler</a>
		<span class="text-text-3">/</span>
		<span class="text-text-1 font-medium">{meta.label}</span>
	</nav>

	<!-- ── Hero: gauge + meta + KPI grid ────────────────────────────── -->
	<div
		class="bg-surface-1 border border-border rounded-lg p-6 border-l-4 {zoneBorderClass(
			data.categoryScore.gpi
		)} shadow-sm"
	>
		<div class="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
			<!-- Gauge -->
			<div class="flex flex-col items-center justify-center">
				<svg width={gaugeSize} height={gaugeSize} viewBox="0 0 {gaugeSize} {gaugeSize}">
					<circle
						cx={gaugeSize / 2}
						cy={gaugeSize / 2}
						r={gaugeR}
						fill="none"
						stroke="var(--color-surface-2)"
						stroke-width="10"
					/>
					<circle
						cx={gaugeSize / 2}
						cy={gaugeSize / 2}
						r={gaugeR}
						fill="none"
						stroke={gaugeColor}
						stroke-width="10"
						stroke-dasharray={gaugeC}
						stroke-dashoffset={gaugeOffset}
						stroke-linecap="round"
						transform="rotate(-90 {gaugeSize / 2} {gaugeSize / 2})"
						style="transition: stroke-dashoffset 0.7s ease"
					/>
					<text
						x={gaugeSize / 2}
						y={gaugeSize / 2 + 8}
						text-anchor="middle"
						class="fill-text-1 font-bold"
						style="font-size: 32px"
					>
						{data.categoryScore.gpi.toFixed(1)}
					</text>
					<text
						x={gaugeSize / 2}
						y={gaugeSize / 2 + 30}
						text-anchor="middle"
						class="fill-text-3"
						style="font-size: 11px"
					>
						/ 100
					</text>
				</svg>
			</div>

			<!-- Right column: heading + KPI tiles -->
			<div class="space-y-4 min-w-0">
				<div>
					<h1 class="text-2xl font-bold text-text-1">{meta.label}</h1>
					<p class="text-sm text-text-2 mt-1">
						Sorumlu departman:
						<span class="font-medium text-text-1">{meta.department}</span>
						<span class="text-text-3 mx-2">·</span>
						Ağırlık: <span class="font-mono">×{(meta.weight * 100).toFixed(0)}%</span>
					</p>
				</div>

				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
					<div class="rounded-md bg-surface-2 p-3">
						<div class="text-xs text-text-3 mb-0.5">Yorum sayısı</div>
						<div class="font-bold text-text-1">{data.categoryScore.reviewCount}</div>
					</div>
					<div class="rounded-md bg-success-light p-3">
						<div class="text-xs text-success/80 mb-0.5">Olumlu</div>
						<div class="font-bold text-success">{data.categoryScore.positiveCount}</div>
					</div>
					<div class="rounded-md bg-danger-light p-3">
						<div class="text-xs text-danger/80 mb-0.5">Olumsuz</div>
						<div class="font-bold text-danger">{data.categoryScore.negativeCount}</div>
					</div>
					<div class="rounded-md bg-surface-2 p-3">
						<div class="text-xs text-text-3 mb-0.5">Trend</div>
						<div class="font-bold {trendClass(data.categoryScore.trend)}">
							{trendIcon(data.categoryScore.trend)} {fmtTrend(data.categoryScore.trend)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Subcategory breakdown ─────────────────────────────────────── -->
	<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
		<h2 class="text-base font-semibold text-text-1 mb-4">Alt Kategori Dağılımı</h2>

		{#if subBreakdown.length === 0}
			<p class="text-sm text-text-3">Bu kategori için alt kategori verisi yok.</p>
		{:else}
			<div class="space-y-3">
				{#each subBreakdown as agg (agg.subcategory)}
					{@const total = agg.positive + agg.negative + agg.neutral}
					{@const isFilter = subcatFilter === agg.subcategory}
					<button
						class="w-full text-left group"
						onclick={() => (subcatFilter = isFilter ? null : agg.subcategory)}
						title={isFilter
							? 'Filtreyi kaldır'
							: `Sadece "${subcategoryLabel(agg.subcategory)}" yorumlarını göster`}
					>
						<div class="flex items-center justify-between mb-1.5">
							<span class="text-sm capitalize group-hover:text-brand transition-colors">
								{subcategoryLabel(agg.subcategory)}
								{#if isFilter}
									<span class="text-xs text-brand">(filtre aktif)</span>
								{/if}
							</span>
							<span class="text-xs text-text-3 font-mono">{total} yorum</span>
						</div>
						{#if total === 0}
							<div class="h-2 rounded-full bg-surface-2"></div>
						{:else}
							<div class="flex h-2 rounded-full overflow-hidden bg-surface-2">
								<div
									class="bg-success"
									style="width: {(agg.positive / total) * 100}%"
								></div>
								<div
									class="bg-text-3/60"
									style="width: {(agg.neutral / total) * 100}%"
								></div>
								<div
									class="bg-danger"
									style="width: {(agg.negative / total) * 100}%"
								></div>
							</div>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ── Issues + Praises ──────────────────────────────────────────── -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<h3 class="text-base font-semibold text-text-1 mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-danger"></span>
				Sorunlar
			</h3>
			{#if data.categoryScore.topIssues.length === 0}
				<p class="text-sm text-text-3">Bu kategoride sorun bildirimi yok.</p>
			{:else}
				<ul class="divide-y divide-border">
					{#each data.categoryScore.topIssues as issue (issue.subcategory)}
						<li class="py-2.5 grid grid-cols-[1fr_3rem] gap-3 items-start">
							<div class="min-w-0">
								<div class="text-sm font-medium text-text-1 capitalize">
									{subcategoryLabel(issue.subcategory)}
								</div>
								<div class="text-xs text-text-3 italic truncate">"{issue.sampleExcerpt}"</div>
							</div>
							<span class="text-sm font-bold text-danger text-right">×{issue.count}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
			<h3 class="text-base font-semibold text-text-1 mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-success"></span>
				Övgüler
			</h3>
			{#if data.categoryScore.topPraises.length === 0}
				<p class="text-sm text-text-3">Bu kategoride özel övgü yok.</p>
			{:else}
				<ul class="divide-y divide-border">
					{#each data.categoryScore.topPraises as praise (praise.subcategory)}
						<li class="py-2.5 grid grid-cols-[1fr_3rem] gap-3 items-start">
							<div class="min-w-0">
								<div class="text-sm font-medium text-text-1 capitalize">
									{subcategoryLabel(praise.subcategory)}
								</div>
								<div class="text-xs text-text-3 italic truncate">"{praise.sampleExcerpt}"</div>
							</div>
							<span class="text-sm font-bold text-success text-right">×{praise.count}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- ── Review feed ────────────────────────────────────────────────── -->
	<section class="space-y-3">
		<header class="flex items-center justify-between flex-wrap gap-2">
			<h2 class="text-base font-semibold text-text-1">
				Bu Kategorideki Yorumlar
				<span class="text-text-3 font-normal">({filteredReviews.length})</span>
			</h2>

			<!-- Sentiment filter -->
			<div class="flex items-center gap-1 text-sm">
				{#each ['all', 'positive', 'negative', 'mixed'] as opt (opt)}
					{@const isActive = sentimentFilter === opt}
					{@const label = opt === 'all' ? 'Tümü' : opt === 'positive' ? 'Olumlu' : opt === 'negative' ? 'Olumsuz' : 'Karışık'}
					<button
						onclick={() => (sentimentFilter = opt as typeof sentimentFilter)}
						class={[
							'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
							isActive
								? opt === 'positive'
									? 'bg-success-light text-success border-success'
									: opt === 'negative'
										? 'bg-danger-light text-danger border-danger'
										: opt === 'mixed'
											? 'bg-warning-light text-warning border-warning'
											: 'bg-brand-light text-brand border-brand'
								: 'bg-surface-1 text-text-2 border-border hover:bg-surface-2'
						]}
					>
						{label}
					</button>
				{/each}
			</div>
		</header>

		{#if filteredReviews.length === 0}
			<div class="bg-surface-1 border border-border rounded-lg p-8 text-center text-text-3 text-sm">
				Bu filtreler için yorum bulunamadı.
				<button
					class="block mx-auto mt-2 text-brand text-xs hover:underline"
					onclick={() => {
						subcatFilter = null;
						sentimentFilter = 'all';
					}}
				>
					Filtreleri temizle →
				</button>
			</div>
		{:else}
			<ul class="space-y-2">
				{#each filteredReviews as review (review.id)}
					<li>
						<button
							class="w-full text-left bg-surface-1 border border-border rounded-lg p-4 hover:shadow-md hover:border-brand/30 transition-all"
							onclick={() => openModal(review)}
						>
							<div class="flex items-center gap-2 text-xs text-text-3 mb-1.5 flex-wrap">
								<span class="text-warning">{stars(review.rating)}</span>
								<span>·</span>
								<span>{fmtDate(review.publishedDate)}</span>
								<span>·</span>
								<span class="uppercase tracking-wider font-medium">{review.lang}</span>
							</div>
							<div class="text-sm font-semibold text-text-1 mb-1">{review.title}</div>
							<div class="text-xs text-text-2 line-clamp-2">{review.text}</div>
							{#if review.ownerResponse}
								<div class="mt-2 text-xs text-brand">↳ Otele cevap verilmiş</div>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<ReviewDetailModal
	review={modalReview}
	open={modalOpen}
	onOpenChange={(v) => (modalOpen = v)}
/>
