<!--
  ECHO OS — Rakipler (Competitors) lens. Real competitor + hotel scores from the
  backend (getCompetitorScores / getHotelScore), rendered in the OS lens style.
  GPI ranking + category heatmap mirror the (app)/benchmark logic; CQI is derived
  live from own-vs-market GPI (no mock). Department/language breakdown is a
  [MOCK→radar] placeholder noted in ECHO_OS_GAP_PLAN.md.
-->
<script lang="ts">
	import { CATEGORIES, gpiZone, type CategoryKey } from '@talkwo/echo-core';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import { Swords, BarChart3, Grid3x3 } from '@lucide/svelte';

	let { data } = $props();

	// ── Market average + CQI (derived live, not mocked) ──────────────────────
	const competitorAvg = $derived(
		data.competitors.length === 0
			? 0
			: data.competitors.reduce((s, c) => s + c.gpi, 0) / data.competitors.length
	);
	// CQI = own GPI normalized to market average (100 = market par; >100 ahead).
	const cqi = $derived(competitorAvg === 0 ? null : (data.hotelScore.gpi / competitorAvg) * 100);

	type Tone = 'neutral' | 'success' | 'warning' | 'danger';
	const cqiTone = $derived<Tone>(cqi === null ? 'neutral' : cqi >= 100 ? 'success' : cqi >= 95 ? 'warning' : 'danger');

	// ── Sortable rows: own hotel + competitors, GPI descending ───────────────
	type Row = {
		venueSlug: string;
		venueName: string;
		gpi: number;
		reviewCount: number;
		isOwn: boolean;
		region?: string;
		sameRegion: boolean;
	};

	const allRows = $derived.by<Row[]>(() => {
		const rows: Row[] = [
			{
				venueSlug: data.hotelScore.venueSlug,
				venueName: data.venueName,
				gpi: data.hotelScore.gpi,
				reviewCount: data.hotelScore.reviewCount,
				isOwn: true,
				region: data.ownRegion,
				sameRegion: true
			},
			...data.competitors.map((c) => {
				const region = data.competitorRegions[c.venueSlug];
				return {
					venueSlug: c.venueSlug,
					venueName: c.venueName,
					gpi: c.gpi,
					reviewCount: c.reviewCount,
					isOwn: false,
					region,
					sameRegion: !!data.ownRegion && region === data.ownRegion
				};
			})
		];
		return rows.sort((a, b) => b.gpi - a.gpi);
	});

	const ownRank = $derived(allRows.findIndex((r) => r.isOwn) + 1);

	// ── Heatmap (LOCATION/SECURITY are non-GPI categories, excluded) ─────────
	const allCategories: CategoryKey[] = [
		'FOOD', 'ROOM', 'STAFF', 'FRONT', 'POOL', 'BEACH',
		'ENTERTAINMENT', 'KIDS', 'FACILITY', 'SPA', 'VALUE', 'GENERAL'
	];

	function categoryGpiForVenue(slug: string, category: CategoryKey): number | null {
		if (slug === data.hotelScore.venueSlug) {
			return data.hotelScore.categoryScores.find((c) => c.category === category)?.headlineScore ?? null;
		}
		const comp = data.competitors.find((c) => c.venueSlug === slug);
		return comp?.categoryScores.find((c) => c.category === category)?.headlineScore ?? null;
	}

	function heatmapBg(gpi: number | null): string {
		if (gpi === null) return 'bg-surface-2 text-text-3';
		const z = gpiZone(gpi);
		return z === 'green' ? 'bg-success-light text-success'
			: z === 'yellow' ? 'bg-warning-light text-warning'
			: 'bg-danger-light text-danger';
	}

	function barWidth(gpi: number): number {
		// Scale relative to the 50-100 range so differences are visible.
		const pct = ((gpi - 50) / 50) * 100;
		return Math.max(5, Math.min(100, pct));
	}

	function barColor(gpi: number): string {
		const z = gpiZone(gpi);
		return z === 'green' ? 'bg-success' : z === 'yellow' ? 'bg-warning' : 'bg-danger';
	}
</script>

<!-- ── KPI strip ─────────────────────────────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
	<StatTile
		label="CQI"
		value={cqi !== null ? cqi.toFixed(0) : '—'}
		tone={cqiTone}
		emphasis="primary"
		caption={cqi === null ? 'rakip yok' : cqi >= 100 ? 'pazarın önünde' : 'pazarın gerisinde'}
	/>
	<StatTile
		label="RPI"
		value={data.hotelScore.rpi?.toFixed(1) ?? '—'}
		caption="rakip endeksi"
	/>
	<StatTile
		label="Sıralama"
		value={ownRank > 0 ? `${ownRank}/${allRows.length}` : '—'}
		caption="GPI'ye göre"
	/>
	<StatTile
		label="Pazar Ortalaması"
		value={competitorAvg.toFixed(1)}
		caption="{data.competitors.length} rakip GPI ort."
	/>
</div>

<!-- ── GPI comparison bars ───────────────────────────────────────────────── -->
<SectionCard title="Genel GPI Karşılaştırması" icon={BarChart3} hint="GPI azalan" class="mb-3.5">
	<ul class="flex flex-col gap-2">
		{#each allRows as row (row.venueSlug)}
			<li
				class="grid grid-cols-[14rem_1fr_4.5rem] items-center gap-3 rounded-lg p-2.5 transition-colors
					{row.isOwn ? 'bg-warning-light/40 ring-1 ring-warning/30' : 'hover:bg-surface-2'}"
			>
				<div class="flex min-w-0 items-center gap-2">
					{#if row.isOwn}
						<span class="shrink-0 font-bold text-warning" title="Sizin oteliniz">▶</span>
					{/if}
					<span class="truncate text-[13px] font-semibold text-text-1" title={row.venueName}>{row.venueName}</span>
					{#if row.sameRegion && !row.isOwn}
						<span class="shrink-0 rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand" title="Aynı bölge: {row.region}">Aynı bölge</span>
					{:else if row.region && !row.isOwn}
						<span class="shrink-0 text-[11px] text-text-3">{row.region}</span>
					{/if}
				</div>
				<div class="h-2.5 overflow-hidden rounded-full bg-surface-2">
					<div class="h-full rounded-full transition-all duration-500 {barColor(row.gpi)}" style="width:{barWidth(row.gpi)}%"></div>
				</div>
				<div class="text-right">
					<div class="text-[15px] font-extrabold {gpiZone(row.gpi) === 'green' ? 'text-success' : gpiZone(row.gpi) === 'yellow' ? 'text-warning' : 'text-danger'}">{row.gpi.toFixed(1)}</div>
					<div class="font-mono text-[10.5px] text-text-3">{row.reviewCount.toLocaleString('tr-TR')}</div>
				</div>
			</li>
		{/each}
		<!-- Market average row -->
		<li class="grid grid-cols-[14rem_1fr_4.5rem] items-center gap-3 rounded-lg border border-dashed border-text-3/20 p-2.5">
			<div class="flex min-w-0 items-center gap-2">
				<span class="shrink-0 text-text-3">—</span>
				<span class="truncate text-[13px] italic text-text-2">Pazar Ortalaması</span>
			</div>
			<div class="h-2.5 overflow-hidden rounded-full bg-surface-2">
				<div class="h-full rounded-full bg-text-3/40" style="width:{barWidth(competitorAvg)}%"></div>
			</div>
			<div class="text-right text-[15px] font-extrabold text-text-2">{competitorAvg.toFixed(1)}</div>
		</li>
	</ul>
</SectionCard>

<!-- ── Category heatmap ──────────────────────────────────────────────────── -->
<SectionCard title="Kategori Bazlı Karşılaştırma" icon={Grid3x3} hint="yeşil ≥85 · sarı 70-84 · kırmızı <70" class="mb-3.5">
	<div class="overflow-x-auto">
		<table class="min-w-full border-collapse text-sm">
			<thead>
				<tr class="border-b border-border">
					<th class="sticky left-0 bg-surface-1 py-2 pr-3 text-left text-[12px] font-bold text-text-2">Kategori</th>
					{#each allRows as row (row.venueSlug)}
						<th class="min-w-[7.5rem] px-2 py-2 text-center text-[12px] font-bold {row.isOwn ? 'text-warning' : 'text-text-2'}">
							<div class="truncate" title={row.venueName}>{row.isOwn ? '▶ ' : ''}{row.venueName}</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each allCategories as cat (cat)}
					{@const meta = CATEGORIES[cat]}
					<tr class="border-b border-border last:border-b-0">
						<td class="sticky left-0 bg-surface-1 py-2 pr-3">
							<div class="text-[12.5px] font-semibold text-text-1">{meta.label}</div>
							<div class="text-[10.5px] text-text-3">×{(meta.weight * 100).toFixed(0)}%</div>
						</td>
						{#each allRows as row (row.venueSlug)}
							{@const gpi = categoryGpiForVenue(row.venueSlug, cat)}
							<td class="px-1 py-1">
								<div class="rounded-md py-1.5 text-center font-mono text-[12.5px] font-semibold {heatmapBg(gpi)} {row.isOwn ? 'ring-1 ring-warning/40' : ''}">
									{gpi !== null ? gpi.toFixed(1) : '—'}
								</div>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</SectionCard>

<!-- Department/source/language breakdown — [MOCK→radar], not yet wired. -->
<SectionCard title="Departman & dil kırılımı" icon={Swords} hint="yakında">
	<p class="py-6 text-center text-[13px] text-text-3">
		Rakip kıyaslamasında departman, kaynak ve dil bazlı kırılım
		<span class="font-medium text-text-2">Phase 2'de</span> radar verisiyle gelecek.
	</p>
</SectionCard>
