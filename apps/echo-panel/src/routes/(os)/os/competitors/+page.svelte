<!--
  ECHO OS — Rakipler (Competitors) lens. Real competitor + hotel scores from the
  backend (getCompetitorScores / getHotelScore), rendered in the OS lens style.
  GPI ranking + category heatmap mirror the (app)/benchmark logic; CQI is derived
  live from own-vs-market GPI (no mock). Department/language breakdown is a
  [MOCK→radar] placeholder noted in ECHO_OS_GAP_PLAN.md.
-->
<script lang="ts">
	import { CATEGORIES, gpiZone, type CategoryKey } from '@talkwo/echo-core';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import { Swords, BarChart3, Grid3x3, Building2, Globe } from '@lucide/svelte';

	let { data } = $props();

	// The time window comes from the global rail selector (?window=, shared across
	// every lens); this page just consumes data.window that the SSR load resolved.

	// ── Platform lens ────────────────────────────────────────────────────────
	// A channel tab bar filters the WHOLE page (GPI bars + category heatmap + the
	// department comparison) to one platform's snapshot. 'all' = blended overall.
	// URL-driven (?platform=) so it survives refresh/share and every section's SSR
	// load reads the same channel.
	const PLATFORM_TABS = [
		{ key: 'all', label: 'Genel' },
		{ key: 'tripadvisor', label: 'TripAdvisor' },
		{ key: 'google', label: 'Google' },
		{ key: 'booking', label: 'Booking' },
		{ key: 'holidaycheck', label: 'HolidayCheck' }
	] as const;
	const activePlatform = $derived(data.platform ?? 'all');

	function selectPlatform(key: string) {
		if (key === activePlatform) return;
		const url = new URL(page.url);
		if (key === 'all') url.searchParams.delete('platform');
		else url.searchParams.set('platform', key);
		goto(url.pathname + url.search, { keepFocus: true, noScroll: true, invalidateAll: true });
	}

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
		isMock: boolean;
	};

	// Slugs backed by demo data, not real scores — badged "demo" in the list.
	const mockSlugSet = $derived(new Set(data.mockSlugs ?? []));
	// Any demo data on the page at all → show the explanatory banner.
	const hasMock = $derived((data.pageIsMock ?? false) || mockSlugSet.size > 0);

	const allRows = $derived.by<Row[]>(() => {
		const rows: Row[] = [
			{
				venueSlug: data.hotelScore.venueSlug,
				venueName: data.venueName,
				gpi: data.hotelScore.gpi,
				reviewCount: data.hotelScore.reviewCount,
				isOwn: true,
				region: data.ownRegion,
				sameRegion: true,
				// Own venue is real in live mode; only demo when the whole page is mock.
				isMock: data.pageIsMock ?? false
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
					sameRegion: !!data.ownRegion && region === data.ownRegion,
					isMock: mockSlugSet.has(c.venueSlug)
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

	// ── Department comparison (grouped bars) ─────────────────────────────────
	// data.deptCompare rolls own + each competitor up to department scores (backend
	// /departments/:slug/compare, same mention-weighted rollup as the owned lens). We
	// pivot it to one group per department, each holding own + rival bars. Departments
	// where no venue has a score drop out; own's score orders them worst-first (that's
	// where an operator looks). Null (no mentions) bars render as a dash, not a 0-bar.
	type DeptBar = { venueName: string; score: number | null; isOwn: boolean };
	type DeptGroup = { key: string; label: string; bars: DeptBar[]; ownScore: number | null };

	const deptGroups = $derived.by<DeptGroup[]>(() => {
		const dc = data.deptCompare;
		if (!dc) return [];
		// Department order + labels come from the OWN venue's rollup (canonical set).
		const groups: DeptGroup[] = dc.own.departments.map((d) => {
			const bars: DeptBar[] = [
				{ venueName: dc.own.venueName, score: d.score, isOwn: true },
				...dc.competitors.map((c) => ({
					venueName: c.venueName,
					score: c.departments.find((x) => x.key === d.key)?.score ?? null,
					isOwn: false
				}))
			];
			return { key: d.key, label: d.label, bars, ownScore: d.score };
		});
		// Keep only departments where at least one venue has a real score.
		const scored = groups.filter((g) => g.bars.some((b) => b.score != null));
		// Worst own-score first; departments with no own score sink to the bottom.
		return scored.sort((a, b) => {
			if (a.ownScore == null) return 1;
			if (b.ownScore == null) return -1;
			return a.ownScore - b.ownScore;
		});
	});

	const activePlatformLabel = $derived(
		PLATFORM_TABS.find((t) => t.key === activePlatform)?.label ?? 'Genel'
	);
</script>

<!-- ── Header: title. The time window is chosen from the global rail selector
     (shared across every lens), so no per-page control here. ──────────────── -->
<div class="mb-3.5 flex items-center gap-2">
	<Swords class="size-[18px] text-text-2" />
	<h1 class="text-[15px] font-bold">Rakipler</h1>
</div>

<!-- ── Platform lens tabs — filter the whole page to one channel (?platform=). ── -->
<div class="mb-3.5 flex flex-wrap items-center gap-2">
	{#each PLATFORM_TABS as tab (tab.key)}
		{@const isActive = activePlatform === tab.key}
		<button
			onclick={() => selectPlatform(tab.key)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors
				{isActive
				? 'border-transparent bg-text-1 text-white'
				: 'border-border bg-surface-1 text-text-2 hover:bg-surface-2'}"
		>
			{tab.label}
		</button>
	{/each}
</div>

{#if !data.ownOnPlatform && activePlatform !== 'all'}
	<!-- Own venue has no snapshot on this channel → its numbers below are the blended
	     overall, while rivals are channel-specific. Rare for a real venue; flag it. -->
	<div class="mb-3.5 rounded-[11px] border border-border bg-surface-1 px-3.5 py-2 text-[12px] text-text-3">
		Bu kanalda otelinizin ayrı skoru yok — kendi satırınız <strong class="text-text-2">genel</strong> skoru gösteriyor,
		rakipler {activePlatformLabel} skorunu.
	</div>
{/if}

{#if hasMock}
	<!-- Demo-data notice: some/all rows are placeholders, not real scores. Prevents
	     users from mistaking demo rivals for live competitors. -->
	<div
		class="mb-3.5 flex items-center gap-2 rounded-[11px] border border-warning/30 bg-warning-light/50 px-3.5 py-2.5 text-[12.5px] text-text-1"
		role="status"
	>
		<span class="text-warning">⚠</span>
		<span>
			{#if data.pageIsMock}
				Bu sayfa <strong>örnek (demo) veri</strong> gösteriyor. Gerçek skorlar için veri kaynağını canlıya alın.
			{:else}
				<strong>demo</strong> etiketli rakipler örnek veridir — henüz gerçek skoru olmayan rakipler için yer tutucu gösteriliyor.
			{/if}
		</span>
	</div>
{/if}

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
					{#if row.isMock}
						<span
							class="shrink-0 rounded bg-warning-light px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning"
							title="Örnek (demo) veri — gerçek skor değil"
						>demo</span>
					{/if}
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

<!-- ── Department comparison (grouped bars) ──────────────────────────────────
     Each department: own + rival bars, worst own-score first. Same mention-weighted
     rollup as the owned Departmanlar lens (backend /departments/:slug/compare). -->
<SectionCard
	title="Departman Bazlı Karşılaştırma"
	icon={Building2}
	hint={activePlatform === 'all' ? 'departman GPI · en zayıf üstte' : `${activePlatformLabel} · departman GPI`}
>
	{#if deptGroups.length === 0}
		<p class="py-6 text-center text-[13px] text-text-3">
			{#if data.pageIsMock}
				Departman karşılaştırması yalnızca canlı veride görünür.
			{:else}
				Bu {activePlatform === 'all' ? 'dönemde' : 'kanalda'} departman bazlı karşılaştırma için yeterli veri yok.
			{/if}
		</p>
	{:else}
		<div class="flex flex-col gap-4">
			{#each deptGroups as g (g.key)}
				<div>
					<div class="mb-1.5 text-[12.5px] font-bold text-text-1">{g.label}</div>
					<ul class="flex flex-col gap-1.5">
						{#each g.bars as bar (bar.venueName)}
							<li class="grid grid-cols-[12rem_1fr_3rem] items-center gap-2.5">
								<span
									class="flex min-w-0 items-center gap-1.5 text-[12px] {bar.isOwn ? 'font-semibold text-text-1' : 'text-text-2'}"
									title={bar.venueName}
								>
									{#if bar.isOwn}<span class="shrink-0 text-warning">▶</span>{/if}
									<span class="truncate">{bar.venueName}</span>
								</span>
								<span class="h-2 overflow-hidden rounded-full bg-surface-2">
									{#if bar.score != null}
										<span
											class="block h-full rounded-full transition-all duration-500 {barColor(bar.score)} {bar.isOwn ? '' : 'opacity-70'}"
											style="width:{barWidth(bar.score)}%"
										></span>
									{/if}
								</span>
								<span
									class="text-right text-[12.5px] font-bold tabular-nums {bar.score == null
										? 'text-text-3'
										: gpiZone(bar.score) === 'green'
											? 'text-success'
											: gpiZone(bar.score) === 'yellow'
												? 'text-warning'
												: 'text-danger'}"
								>
									{bar.score != null ? bar.score.toFixed(1) : '—'}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</SectionCard>

<!-- Source/language breakdown dropped from scope (owner, 2026-07-07): the value is in
     the department + platform comparisons above, both now live. -->
<p class="mt-3.5 flex items-center justify-center gap-1.5 text-[11.5px] text-text-3">
	<Globe size={13} /> Kaynak & dil bazlı rakip kırılımı kapsam dışı — departman ve platform karşılaştırması yukarıda.
</p>
