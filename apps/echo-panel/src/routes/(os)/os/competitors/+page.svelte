<!--
  ECHO OS — Rakipler (Competitors) lens. Real competitor + hotel scores from the
  backend (getCompetitorScores / getHotelScore), rendered in the OS lens style.
  GPI ranking + category heatmap mirror the (app)/benchmark logic; CQI is derived
  live from own-vs-market GPI (no mock). Platform comparison pivots each channel's
  persisted per-platform snapshot into own-vs-rival bars (real-only).
-->
<script lang="ts">
	import { CATEGORIES, gpiZone, type CategoryKey } from '@talkwo/echo-core';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import { Swords, BarChart3, Grid3x3, Building2, Globe } from '@lucide/svelte';

	let { data } = $props();

	// The time window comes from the global rail selector (?window=, shared across
	// every lens); this page just consumes data.window that the SSR load resolved.

	// ── Market average ────────────────────────────────────────────────────────
	const competitorAvg = $derived(
		data.competitors.length === 0
			? 0
			: data.competitors.reduce((s, c) => s + c.gpi, 0) / data.competitors.length
	);

	type Tone = 'neutral' | 'success' | 'warning' | 'danger';

	// The headline tile is the venue's own GPI, coloured by the standard zones
	// (echo-core gpiZone: ≥85 good, 70–84 warn, <70 bad) so it reads the same here as
	// everywhere else in the product.
	const gpiTone = $derived<Tone>(
		(({ green: 'success', yellow: 'warning', red: 'danger' }) as Record<string, Tone>)[
			gpiZone(data.hotelScore.gpi)
		] ?? 'neutral'
	);

	// Caption says where that score sits relative to the market — which is the question
	// this whole lens exists to answer.
	const rpiCaption = $derived(
		competitorAvg === 0
			? 'rakip yok'
			: data.hotelScore.gpi >= competitorAvg
				? `pazarın ${(data.hotelScore.gpi - competitorAvg).toFixed(1)} puan önünde`
				: `pazarın ${(competitorAvg - data.hotelScore.gpi).toFixed(1)} puan gerisinde`
	);

	// ── Sortable rows: own hotel + competitors, GPI descending ───────────────
	// Every row is a real, scored venue now. The loader no longer ships mockSlugs /
	// pageIsMock (there is no mock fallback to flag) nor region labels (they came from
	// a hardcoded slug→town map), so Row carries neither a "demo" flag nor a region.
	type Row = {
		venueSlug: string;
		venueName: string;
		gpi: number;
		reviewCount: number;
		isOwn: boolean;
	};

	// No rivals configured → the page shows an empty state instead of inventing some.
	const hasCompetitors = $derived(data.competitors.length > 0);

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

	const ownRank = $derived(allRows.findIndex((r) => r.isOwn) + 1);

	// ── Heatmap (LOCATION/SECURITY are non-GPI categories, excluded) ─────────
	const allCategories: CategoryKey[] = [
		'FOOD', 'ROOM', 'STAFF', 'FRONT', 'POOL', 'BEACH',
		'ENTERTAINMENT', 'KIDS', 'FACILITY', 'SPA', 'VALUE', 'GENERAL'
	];

	// Use aspectScore, NOT headlineScore: the category comparison must be on the SAME
	// pure-aspect scale as the venue GPI (GPI_SAF_ASPECT_PLAN.md). headlineScore is the
	// legacy star-anchored blend (~71-82) — showing it here made categories read ~80-90
	// while the venue GPI reads ~58, an obvious contradiction. aspectScore (~31-73) is the
	// content signal, consistent with GPI and the Departmanlar/Genel lenses.
	function categoryGpiForVenue(slug: string, category: CategoryKey): number | null {
		if (slug === data.hotelScore.venueSlug) {
			return data.hotelScore.categoryScores.find((c) => c.category === category)?.aspectScore ?? null;
		}
		const comp = data.competitors.find((c) => c.venueSlug === slug);
		return comp?.categoryScores.find((c) => c.category === category)?.aspectScore ?? null;
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

	// ── Platform comparison (grouped bars) ───────────────────────────────────
	// data.platformCompare holds one entry per channel (TripAdvisor/Google/Booking/
	// HolidayCheck), each with the own GPI + every rival's GPI on THAT channel (backend
	// persists per-platform snapshots). We pivot to one group per platform, each holding
	// own + rival bars. Channels keep their canonical order (NOT sorted by score — that
	// only made sense for departments). Null (no snapshot) bars render as a dash, not a 0-bar.
	type PlatformBar = { venueName: string; score: number | null; isOwn: boolean };
	type PlatformGroup = { key: string; label: string; bars: PlatformBar[] };

	const platformGroups = $derived.by<PlatformGroup[]>(() => {
		const pc = data.platformCompare;
		if (!pc) return [];
		return pc.platforms.map((p) => {
			const bars: PlatformBar[] = [
				{ venueName: pc.ownVenueName, score: p.ownGpi, isOwn: true },
				...p.rivals.map((r) => ({ venueName: r.venueName, score: r.gpi, isOwn: false }))
			];
			return { key: p.key, label: p.label, bars };
		});
	});

	// ── Platform comparison — PUAN (native OTA star) ──────────────────────────
	// Same pivot as platformGroups, but each bar carries the venue's NATIVE star on
	// that channel (own scale: TA/Google /5, HolidayCheck /6, Booking /10) plus the
	// platform's max, so the row can render "8.1/10". Null (no OTA star on that
	// channel) renders as a dash. `max` is per-platform (it differs by channel).
	type StarBar = { venueName: string; star: number | null; isOwn: boolean };
	type StarGroup = { key: string; label: string; max: number | null; bars: StarBar[] };

	const platformStarGroups = $derived.by<StarGroup[]>(() => {
		const pc = data.platformCompare;
		if (!pc) return [];
		return pc.platforms.map((p) => {
			const bars: StarBar[] = [
				{ venueName: pc.ownVenueName, star: p.ownNativeStar, isOwn: true },
				...p.rivals.map((r) => ({ venueName: r.venueName, star: r.nativeStar, isOwn: false }))
			];
			return { key: p.key, label: p.label, max: p.nativeStarMax, bars };
		});
	});

	// Native star → bar width + colour. Normalized on star/max (ratio) so all three
	// scales (TA/Google 5, HolidayCheck 6, Booking 10) read on one 0-100% axis and the
	// colour thresholds are scale-independent. Full-scale (not floored like GPI's 50-100
	// trick): a star bar is a familiar "% of max" and hotels DO span the low end on some
	// channels, so squashing to a floor would hide a genuinely weak score. Thresholds:
	// ≥90% green (≈4.5/5, 9/10), ≥80% yellow, else red — one notch stricter than a
	// human "4 stars is fine", because in this market the field clusters high.
	function starWidth(star: number, max: number): number {
		return Math.max(5, Math.min(100, (star / max) * 100));
	}
	function starZone(star: number, max: number): 'green' | 'yellow' | 'red' {
		const ratio = star / max;
		return ratio >= 0.9 ? 'green' : ratio >= 0.8 ? 'yellow' : 'red';
	}
	function starColor(star: number, max: number): string {
		const z = starZone(star, max);
		return z === 'green' ? 'bg-success' : z === 'yellow' ? 'bg-warning' : 'bg-danger';
	}
</script>

<!-- ── Header: title. The time window is chosen from the global rail selector
     (shared across every lens), so no per-page control here. ──────────────── -->
<div class="mb-3.5 flex items-center gap-2">
	<Swords class="size-[18px] text-text-2" />
	<h1 class="text-[15px] font-bold">Rakipler</h1>
</div>

<!-- The "mock veri" warning banner is gone with the mock fallback it warned about:
     nothing on this page is a placeholder any more. Zero rivals now reads as zero
     rivals (empty state below), not as a fake leaderboard with a disclaimer. -->
{#if !hasCompetitors}
	<div
		class="mb-3.5 rounded-[11px] border border-border bg-surface-2 px-3.5 py-6 text-center"
		role="status"
	>
		<p class="text-[13px] font-semibold text-text-1">Bu tenant için rakip takibi henüz kurulmadı.</p>
		<p class="mt-1 text-[12.5px] text-text-3">
			Rakip otelleri tanımladığınızda GPI sıralaması, kategori ısı haritası ve platform
			karşılaştırması burada görünür.
		</p>
	</div>
{/if}

<!-- ── KPI strip ───────────────────────────────────────────────────────────
     Reads as a sentence: my score → where that puts me → what rank → what the
     market looks like.

     The first tile used to be "CQI", computed here as (own GPI ÷ market avg) × 100.
     That is the SAME quantity the backend already ships as `rpi` — so the strip led
     with two tiles showing 95 and 95.1, one index under two names, and the venue's
     own GPI (the number every bar below is ranked by) appeared nowhere. Dropped the
     local duplicate; lead with the score itself. -->
<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
	<StatTile
		label="Genel GPI"
		value={data.hotelScore.gpi.toFixed(1)}
		tone={gpiTone}
		emphasis="primary"
		caption={rpiCaption}
	/>
	<StatTile
		label="RPI"
		value={data.hotelScore.rpi?.toFixed(1) ?? '—'}
		caption="100 = pazar ortalaması"
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
<SectionCard title="Kategori Bazlı Karşılaştırma" icon={Grid3x3} hint="yeşil ≥72 · sarı 62-71 · kırmızı <62" class="mb-3.5">
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

<!-- ── Platform comparison (grouped bars) ────────────────────────────────────
     Each channel: own + rival bars on that platform's snapshot, worst own-score first.
     Per-platform scores come from the backend's persisted per-channel snapshots. -->
<SectionCard
	title="Platform Bazlı Karşılaştırma"
	icon={Building2}
	hint="kanal GPI"
>
	{#if platformGroups.length === 0}
		<p class="py-6 text-center text-[13px] text-text-3">
			Bu dönemde platform bazlı karşılaştırma için yeterli veri yok.
		</p>
	{:else}
		<div class="flex flex-col gap-4">
			{#each platformGroups as g (g.key)}
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

<!-- ── Platform Bazlı Karşılaştırma — PUAN (native OTA star) ──────────────────
     Same layout as the GPI card above, but bars are the venue's native star on each
     channel (own scale, shown "X.X/max"). GPI (aspect) and Puan (star) can tell
     different stories — e.g. weak aspect but high star — which is why both live here. -->
<SectionCard title="Platform Bazlı Karşılaştırma" icon={Building2} hint="puan (OTA)">
	{#if platformStarGroups.length === 0}
		<p class="py-6 text-center text-[13px] text-text-3">
			Bu dönemde platform bazlı puan karşılaştırması için yeterli veri yok.
		</p>
	{:else}
		<div class="flex flex-col gap-4">
			{#each platformStarGroups as g (g.key)}
				<div>
					<div class="mb-1.5 text-[12.5px] font-bold text-text-1">
						{g.label}{#if g.max}<span class="ml-1 text-[11px] font-medium text-text-3">/{g.max}</span>{/if}
					</div>
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
									{#if bar.star != null && g.max}
										<span
											class="block h-full rounded-full transition-all duration-500 {starColor(bar.star, g.max)} {bar.isOwn ? '' : 'opacity-70'}"
											style="width:{starWidth(bar.star, g.max)}%"
										></span>
									{/if}
								</span>
								<span
									class="text-right text-[12.5px] font-bold tabular-nums {bar.star == null || !g.max
										? 'text-text-3'
										: starZone(bar.star, g.max) === 'green'
											? 'text-success'
											: starZone(bar.star, g.max) === 'yellow'
												? 'text-warning'
												: 'text-danger'}"
								>
									{bar.star != null ? bar.star.toFixed(1) : '—'}
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
	<Globe size={13} /> Kaynak & dil bazlı rakip kırılımı kapsam dışı — platform karşılaştırması yukarıda.
</p>
