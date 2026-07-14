<script lang="ts">
	import { CATEGORIES, gpiZone, rpiLabel, type CategoryKey } from '@talkwo/echo-core';

	let { data } = $props();

	// ── Aggregate calculations ──
	const competitorAvg = $derived(
		data.competitors.length === 0
			? 0
			: data.competitors.reduce((s, c) => s + c.gpi, 0) / data.competitors.length
	);

	// Combine own hotel + competitors for sortable bar list.
	// Region/sameRegion dropped: they were fed by a hardcoded slug→town map in the
	// loader (one customer's rivals). Region is venue metadata the backend doesn't
	// serve yet, so the row no longer claims to know it.
	type Row = {
		venueSlug: string;
		venueName: string;
		gpi: number;
		reviewCount: number;
		isOwn: boolean;
	};

	const allRows = $derived.by<Row[]>(() => {
		const rows: Row[] = [
			{
				venueSlug: data.hotelScore.venueSlug,
				venueName: data.venueName,
				gpi: data.hotelScore.gpi,
				reviewCount: data.hotelScore.reviewCount,
				isOwn: true
			},
			...data.competitors.map((c) => ({
				venueSlug: c.venueSlug,
				venueName: c.venueName,
				gpi: c.gpi,
				reviewCount: c.reviewCount,
				isOwn: false
			}))
		];
		return rows.sort((a, b) => b.gpi - a.gpi);
	});

	const maxGpi = $derived(Math.max(...allRows.map((r) => r.gpi), 100));
	const minGpi = $derived(Math.min(...allRows.map((r) => r.gpi), 0));

	// ── RPI ──
	const rpi = $derived(data.hotelScore.rpi);
	const rpiText = $derived(rpi !== null ? rpiLabel(rpi) : '—');
	const rpiZone = $derived(
		rpi === null
			? 'gray'
			: rpi >= 110
				? 'green'
				: rpi >= 100
					? 'green'
					: rpi >= 90
						? 'yellow'
						: 'red'
	);
	const rpiZoneClass = $derived(
		rpiZone === 'green'
			? 'text-success border-l-success'
			: rpiZone === 'yellow'
				? 'text-warning border-l-warning'
				: rpiZone === 'red'
					? 'text-danger border-l-danger'
					: 'text-text-3 border-l-text-3'
	);

	// ── Heatmap helpers ──
	// Note: LOCATION and SECURITY are non-GPI categories, excluded from benchmark.
	const allCategories: CategoryKey[] = [
		'FOOD', 'ROOM', 'STAFF', 'FRONT', 'POOL', 'BEACH',
		'ENTERTAINMENT', 'KIDS', 'FACILITY', 'SPA', 'VALUE', 'GENERAL'
	];

	function categoryGpiForVenue(slug: string, category: CategoryKey): number | null {
		if (slug === data.hotelScore.venueSlug) {
			const cs = data.hotelScore.categoryScores.find((c) => c.category === category);
			return cs?.headlineScore ?? null;
		}
		const comp = data.competitors.find((c) => c.venueSlug === slug);
		const cs = comp?.categoryScores.find((c) => c.category === category);
		return cs?.headlineScore ?? null;
	}

	function heatmapBg(gpi: number | null): string {
		if (gpi === null) return 'bg-surface-2 text-text-3';
		const z = gpiZone(gpi);
		return z === 'green'
			? 'bg-success-light text-success'
			: z === 'yellow'
				? 'bg-warning-light text-warning'
				: 'bg-danger-light text-danger';
	}

	function barWidth(gpi: number): number {
		// Scale bars relative to the 50-100 range so differences are visible
		const min = 50;
		const max = 100;
		const pct = ((gpi - min) / (max - min)) * 100;
		return Math.max(5, Math.min(100, pct));
	}

	function fmtRpi(r: number | null): string {
		if (r === null) return '—';
		return r.toFixed(1);
	}
</script>

<div class="space-y-6">
	<!-- ── RPI Hero ───────────────────────────────────────────────────── -->
	<div
		class="bg-surface-1 border border-border rounded-lg p-6 border-l-4 {rpiZoneClass} shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center"
	>
		<div>
			<div class="text-xs text-text-3 uppercase tracking-wider mb-1">RPI Skoru</div>
			<div class="text-5xl font-bold {rpiZoneClass}">{fmtRpi(rpi)}</div>
			<div class="text-sm text-text-2 mt-1">{rpiText}</div>
		</div>

		<div>
			<div class="text-xs text-text-3 uppercase tracking-wider mb-1">Rakip Sayısı</div>
			<div class="text-3xl font-bold text-text-1">{data.competitors.length}</div>
			<div class="text-xs text-text-3 mt-1">
				Rakip ekletmek için
				<a href="/settings" class="text-brand hover:underline">Ayarlar</a>'a gidin
			</div>
		</div>

		<div>
			<div class="text-xs text-text-3 uppercase tracking-wider mb-1">Pazar Ortalaması</div>
			<div class="text-3xl font-bold text-text-1">{competitorAvg.toFixed(1)}</div>
			<div class="text-xs text-text-3 mt-1">
				{data.competitors.length} rakibin GPI ortalaması
			</div>
		</div>
	</div>

	<!-- ── Comparison bars ────────────────────────────────────────────── -->
	<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
		<header class="mb-4">
			<h2 class="text-base font-semibold text-text-1">Genel GPI Karşılaştırması</h2>
			<p class="text-xs text-text-3 mt-1">
				GPI'ye göre azalan sırayla. <span class="text-warning">▶ Sizin oteliniz</span> ve
				<span class="px-1.5 py-0.5 rounded bg-brand-light text-brand text-xs font-medium">Aynı bölge</span>
				etiketleri vurgulanmıştır.
			</p>
		</header>

		<ul class="space-y-2.5">
			{#each allRows as row (row.venueSlug)}
				<li
					class={[
						'grid grid-cols-[22rem_1fr_5rem] gap-3 items-center p-3 rounded-md transition-colors',
						row.isOwn ? 'bg-warning-light/40 border border-warning/30' : 'bg-surface-2/40 hover:bg-surface-2'
					]}
				>
					<!-- Label column (fixed width — bar always starts at the same x) -->
					<div class="flex items-center gap-2 min-w-0">
						{#if row.isOwn}
							<span class="text-warning font-bold shrink-0" title="Sizin oteliniz">▶</span>
						{/if}
						<span
							class="text-sm font-medium text-text-1 truncate"
							title={row.venueName}
						>
							{row.venueName}
						</span>
					</div>

					<!-- Bar column -->
					<div class="h-3 rounded-full bg-surface-2 overflow-hidden relative">
						<div
							class={[
								'h-full rounded-full transition-all duration-500',
								gpiZone(row.gpi) === 'green'
									? 'bg-success'
									: gpiZone(row.gpi) === 'yellow'
										? 'bg-warning'
										: 'bg-danger'
							]}
							style="width: {barWidth(row.gpi)}%"
						></div>
					</div>

					<!-- Value column -->
					<div class="text-right min-w-[5rem]">
						<div
							class={[
								'text-base font-bold',
								gpiZone(row.gpi) === 'green'
									? 'text-success'
									: gpiZone(row.gpi) === 'yellow'
										? 'text-warning'
										: 'text-danger'
							]}
						>
							{row.gpi.toFixed(1)}
						</div>
						<div class="text-xs text-text-3 font-mono">
							{row.reviewCount.toLocaleString('tr-TR')}
						</div>
					</div>
				</li>
			{/each}

			<!-- Market average row -->
			<li
				class="grid grid-cols-[22rem_1fr_5rem] gap-3 items-center p-3 rounded-md bg-surface-2/20 border border-dashed border-text-3/20"
			>
				<div class="flex items-center gap-2 min-w-0">
					<span class="text-text-3 shrink-0">—</span>
					<span class="text-sm italic text-text-2 truncate">Pazar Ortalaması</span>
				</div>
				<div class="h-3 rounded-full bg-surface-2 overflow-hidden relative">
					<div
						class="h-full rounded-full bg-text-3/40 transition-all duration-500"
						style="width: {barWidth(competitorAvg)}%"
					></div>
				</div>
				<div class="text-right min-w-[5rem]">
					<div class="text-base font-bold text-text-2">{competitorAvg.toFixed(1)}</div>
					<div class="text-xs text-text-3">avg</div>
				</div>
			</li>
		</ul>
	</section>

	<!-- ── Category heatmap ──────────────────────────────────────────── -->
	<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm overflow-x-auto">
		<header class="mb-4">
			<h2 class="text-base font-semibold text-text-1">Kategori Bazlı Karşılaştırma</h2>
			<p class="text-xs text-text-3 mt-1">
				Her hücre: o otelin o kategorideki GPI'si. Renk:
				<span class="text-success font-medium">yeşil ≥85</span> ·
				<span class="text-warning font-medium">sarı 70-84</span> ·
				<span class="text-danger font-medium">kırmızı &lt;70</span>
			</p>
		</header>

		<table class="min-w-full text-sm border-collapse">
			<thead>
				<tr class="border-b border-border">
					<th class="text-left py-2 pr-3 font-semibold text-text-2 sticky left-0 bg-surface-1">
						Kategori
					</th>
					{#each allRows as row (row.venueSlug)}
						<th
							class={[
								'text-center py-2 px-2 font-semibold min-w-[8rem]',
								row.isOwn ? 'text-warning' : 'text-text-2'
							]}
						>
							<div class="truncate" title={row.venueName}>
								{row.isOwn ? '▶ ' : ''}{row.venueName}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each allCategories as cat (cat)}
					{@const meta = CATEGORIES[cat]}
					<tr class="border-b border-border last:border-b-0">
						<td class="py-2 pr-3 sticky left-0 bg-surface-1">
							<div class="font-medium text-text-1">{meta.label}</div>
							<div class="text-xs text-text-3">×{(meta.weight * 100).toFixed(0)}%</div>
						</td>
						{#each allRows as row (row.venueSlug)}
							{@const gpi = categoryGpiForVenue(row.venueSlug, cat)}
							<td class="py-1 px-1">
								<div
									class={[
										'rounded-md text-center py-2 font-mono font-semibold text-sm',
										heatmapBg(gpi),
										row.isOwn ? 'ring-2 ring-warning/40' : ''
									]}
								>
									{gpi !== null ? gpi.toFixed(1) : '—'}
								</div>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<footer class="text-xs text-text-3 text-center">
		Rakip listesi Talkwo ekibi tarafından yönetilir. Liste güncelleme için iletişime geçin.
	</footer>
</div>
