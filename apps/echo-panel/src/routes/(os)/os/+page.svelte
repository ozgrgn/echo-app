<!--
  ECHO OS — Genel lens (the "Gündem" view). Real fields (gpi/rpi/categoryScores…)
  from getHotelScore; series/platform/dept from lib/mock/os (labeled [MOCK→…] in
  ECHO_OS_DATA.md). Built from the shared primitives (StatTile/TrendChart/…).
-->
<script lang="ts">
	import { CATEGORIES, gpiZone, getSubcategoryLabel } from '@talkwo/echo-core';
	import { goto } from '$app/navigation';
	import { hidesCompetitors, parseOsWindow } from '$lib/config/window';
	import { osState } from '$lib/stores/osState.svelte';

	import StatTile from '$lib/components/StatTile.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import PlatformRow from '$lib/components/PlatformRow.svelte';
	import CategoryBar from '$lib/components/CategoryBar.svelte';
	import MentionList from '$lib/components/MentionList.svelte';
	import DeptCard from '$lib/components/DeptCard.svelte';
	import ResponseAnalytics from '$lib/components/ResponseAnalytics.svelte';
	import SegmentBreakdown from '$lib/components/SegmentBreakdown.svelte';
	import MultiTrendChart from '$lib/components/MultiTrendChart.svelte';
	import ImpactList from '$lib/components/ImpactList.svelte';
	import { TrendingUp, Globe, Activity, Users, CircleAlert, ThumbsUp, TriangleAlert, CircleCheck, MessageCircleReply, PieChart, LineChart, Rocket } from '@lucide/svelte';

	import {
		MOCK_OS_DEPTS,
		MOCK_OS_RESPONSE,
		PLATFORM_COLOR,
		type OsPlatform
	} from '$lib/mock/os';

	let { data } = $props();
	const hs = $derived(data.hotelScore);

	// ── GPI trend — REAL series from /v1/scores/:slug/history (backfilled snapshots).
	// Falls back to a single point (today's GPI) when history is missing/empty, so
	// the chart never invents a past. Target line is the only [MOCK→echo] piece.
	const GPI_TARGET = 70;
	const historyGpi = $derived((data.history ?? []).map((p) => p.gpi));
	const trendActual = $derived(historyGpi.length > 0 ? historyGpi : [hs.gpi]);
	const trendYmin = $derived(Math.floor(Math.min(...trendActual, GPI_TARGET) - 4));
	const trendYmax = $derived(Math.ceil(Math.max(...trendActual, GPI_TARGET) + 4));
	const trendHasHistory = $derived(historyGpi.length > 1);

	// Platform comparison chart — our blended line emphasized over each platform.
	const PLATFORM_LABELS: Record<string, string> = {
		tripadvisor: 'TripAdvisor', booking: 'Booking', google: 'Google', holidaycheck: 'HolidayCheck'
	};
	// Per-platform review counts for the CURRENT window (from data.channels, which is
	// window-scoped) — shown in the legend so each platform's weight is visible.
	const platformCounts = $derived(
		new Map((data.channels ?? []).map((c) => [c.platform, c.score.reviewCount]))
	);
	const compareSeries = $derived([
		...((data.platformHistories ?? []).map((ph) => ({
			key: ph.platform,
			label: PLATFORM_LABELS[ph.platform] ?? ph.platform,
			color: PLATFORM_COLOR[ph.platform as keyof typeof PLATFORM_COLOR] ?? '#94a3b8',
			values: ph.points.map((p) => p.gpi),
			count: platformCounts.get(ph.platform),
			emphasis: false
		}))),
		// Our own blended line — emphasized, brand color, on top.
		...(historyGpi.length > 1
			? [{ key: 'all', label: 'GPI (genel)', color: 'var(--color-brand)', values: historyGpi, count: hs.reviewCount, emphasis: true }]
			: [])
	]);
	const hasCompare = $derived(compareSeries.length > 1);
	// Period labels (x-axis) from the blended history — the longest, canonical axis.
	const comparePeriods = $derived((data.history ?? []).map((p) => p.period));

	// Real KPI sparklines + deltas from history (GPI, review count). Last-vs-previous
	// point = the delta. Series capped to the trailing 8 points for a compact spark.
	const spark = (arr: number[]) => arr.slice(-8);
	const lastDelta = (arr: number[]) =>
		arr.length >= 2 ? +(arr[arr.length - 1] - arr[arr.length - 2]).toFixed(1) : 0;
	// Per-period NEW reviews (published that month) — window-independent, always ≥0.
	// The spark shows the monthly new-review trend (never dips like the cumulative,
	// window-scoped reviewCount did); the caption shows the newest period's count.
	const historyNewReviews = $derived((data.history ?? []).map((p) => p.newReviews ?? 0));

	// ────────────────────────────────────────────────────────────────────────
	// CONTRIBUTION POINT — proRateCurrentMonth()
	//
	// The last history point is the CURRENT calendar month, which is only partway
	// through (e.g. today is the 8th → the month has barely started). Its raw
	// new-review count is naturally low, so the spark dips at the end even though
	// nothing is wrong. Rather than estimate it, we simply DROP that partial month
	// from the spark so the line ends on the last COMPLETE month.
	//
	// "Partial" = the newest period equals the running calendar month AND we're not
	// near its end (< 90% elapsed). A near-complete month is kept as-is.
	// ────────────────────────────────────────────────────────────────────────
	function dropPartialMonth(counts: number[], periods: string[]): number[] {
		if (counts.length === 0 || counts.length !== periods.length) return counts;
		const now = new Date();
		const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		if (periods[periods.length - 1] !== curKey) return counts; // ends on a past month

		const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
		const elapsed = now.getDate() / daysInMonth;
		if (elapsed >= 0.9) return counts; // month basically done — keep it
		return counts.slice(0, -1); // drop the unfinished trailing month
	}

	const gpiSpark = $derived(spark(historyGpi));
	const gpiDelta = $derived(lastDelta(historyGpi));
	// Drop the running (partial) month so the spark doesn't show a false end-dip.
	const reviewSpark = $derived(
		dropPartialMonth(spark(historyNewReviews), spark((data.history ?? []).map((p) => p.period)))
	);
	// "This period" = new reviews published in the latest period (not a delta).
	const reviewDelta = $derived(historyNewReviews.length > 0 ? historyNewReviews[historyNewReviews.length - 1] : 0);

	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
	function zoneTone(score: number): Tone {
		const z = gpiZone(score);
		return z === 'green' ? 'success' : z === 'yellow' ? 'warning' : 'danger';
	}
	const gpiTextClass = $derived(
		gpiZone(hs.gpi) === 'green' ? 'text-success' : gpiZone(hs.gpi) === 'yellow' ? 'text-warning' : 'text-danger'
	);

	// Platform list — REAL GPI per channel from data.channels. Static meta (label,
	// brand color via key, display scale) lives here; the score is the real GPI.
	// trend is [MOCK→radar] until the series endpoint lands (single period → flat).
	const PLATFORM_META: Record<string, { label: string; scale: string }> = {
		tripadvisor: { label: 'TripAdvisor', scale: '/100' },
		booking: { label: 'Booking', scale: '/100' },
		google: { label: 'Google', scale: '/100' },
		holidaycheck: { label: 'HolidayCheck', scale: '/100' }
	};

	const platforms = $derived<OsPlatform[]>(
		data.channels.map((c) => {
			const meta = PLATFORM_META[c.platform] ?? { label: c.platform, scale: '/100' };
			return {
				key: c.platform as OsPlatform['key'],
				label: meta.label,
				score: c.score.gpi.toFixed(1),
				scale: meta.scale,
				sub: `${c.score.reviewCount} yorum · GPI ${c.score.gpi.toFixed(1)}`,
				trend: 'flat', // [MOCK→radar] — no series yet (single period)
				enters: true
			};
		})
	);

	// KPI values: [REAL] from HotelScore; competitor metrics from data.competitors
	// (currently the rich mock set — see MOCK_CONFIG.competitors).
	const responseRatePct = $derived(Math.round(hs.responseStats.rate * 100));
	// Market average GPI across competitors → derive RPI + gap when present.
	const competitorAvg = $derived(
		data.competitors.length > 0
			? data.competitors.reduce((s, c) => s + c.gpi, 0) / data.competitors.length
			: null
	);
	const rpiValue = $derived(
		hs.rpi ?? (competitorAvg ? +((hs.gpi / competitorAvg) * 100).toFixed(1) : null)
	);
	const competitorGap = $derived(competitorAvg !== null ? +(hs.gpi - competitorAvg).toFixed(1) : null);

	// In the 'max' (Tümü) lens competitor comparison is hidden — an owned venue's full
	// history isn't comparable to a competitor's ~2 analyzed years (owner decision).
	// Drop the RPI + Rakip Farkı KPI cards; the strip collapses 5→3.
	const hideComp = $derived(hidesCompetitors(parseOsWindow(data.window)));

	// Category movement — [REAL] top categories by mention.
	// Category movement — declining categories first (most actionable), then by
	// mention volume. Shows more rows so the column matches the left stack's height.
	const topCategories = $derived(
		[...hs.categoryScores]
			.sort((a, b) => {
				// Declining (trend < 0) bubble to the top, ranked by how sharp the drop is.
				const aDown = a.trend < 0, bDown = b.trend < 0;
				if (aDown !== bDown) return aDown ? -1 : 1;
				if (aDown && bDown) return a.trend - b.trend; // steeper drop first
				return b.mentionCount - a.mentionCount;
			})
			.slice(0, 10)
			.map((cs) => ({ label: CATEGORIES[cs.category].label, score: cs.headlineScore, trend: cs.trend }))
	);

	// Issues / praises across all categories — [REAL].
	const allIssues = $derived(
		hs.categoryScores
			.flatMap((cs) => cs.topIssues.map((i) => ({ ...i, category: cs.category })))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5)
			.map((i) => ({
				category: CATEGORIES[i.category].label,
				subcategory: getSubcategoryLabel(i.subcategory, 'tr'),
				excerpt: i.sampleExcerpt,
				count: i.count
			}))
	);
	const allPraises = $derived(
		hs.categoryScores
			.flatMap((cs) => cs.topPraises.map((p) => ({ ...p, category: cs.category })))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5)
			.map((p) => ({
				category: CATEGORIES[p.category].label,
				subcategory: getSubcategoryLabel(p.subcategory, 'tr'),
				excerpt: p.sampleExcerpt,
				count: p.count
			}))
	);

	function enterPlatform(key: OsPlatform['key']) {
		osState.setLens({ kind: 'platform', platform: key });
		goto(`/os/platform/${key}`);
	}
	function enterDept(key: string) {
		osState.setLens({ kind: 'department', department: key });
		goto(`/os/department/${key}`);
	}
</script>

<!-- ── Venue hero: neutral band, same skeleton as PlatformHero so lenses align ── -->
<div class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border border-border bg-surface-1 p-5 shadow-card">
	<div class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] bg-gradient-to-br from-[#4f46e5] to-[#a855f7] text-[17px] font-extrabold text-white">
		{hs.venueName.slice(0, 1)}
	</div>
	<div class="min-w-0">
		<div class="text-base font-extrabold tracking-tight text-text-1">{hs.venueName}</div>
		<div class="mt-0.5 text-xs text-text-3">Manavgat · Sezon: Nis–Kas · {hs.reviewCount} yorum</div>
	</div>

	<div class="ml-auto flex items-end gap-4">
		<div class="flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Genel GPI</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight {gpiTextClass}">{hs.gpi.toFixed(1)}</span>
		</div>
	</div>
</div>

<!-- ── KPI strip ─────────────────────────────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-2 gap-3.5 {hideComp ? 'lg:grid-cols-3' : 'lg:grid-cols-5'}">
	<StatTile
		label="Genel GPI"
		value={hs.gpi.toFixed(1)}
		tone={zoneTone(hs.gpi)}
		emphasis="primary"
		caption="hedef {GPI_TARGET}"
		delta={gpiDelta}
		deltaPolarity="higher-better"
		trend={gpiSpark}
	/>
	{#if !hideComp}
		<StatTile
			label="RPI"
			value={rpiValue?.toFixed(1) ?? '—'}
			tone={rpiValue !== null ? (rpiValue >= 100 ? 'success' : 'warning') : 'neutral'}
			caption={competitorAvg !== null ? `${data.competitors.length} rakip · ort ${competitorAvg.toFixed(1)}` : 'rakip endeksi'}
		/>
	{/if}
	<StatTile
		label="Toplam Yorum"
		value={hs.reviewCount.toLocaleString('tr-TR')}
		caption={reviewDelta > 0 ? `bu dönem +${reviewDelta.toLocaleString('tr-TR')} yeni` : 'bu dönem'}
		trend={reviewSpark}
	/>
	<StatTile
		label="Yanıt Oranı"
		value="%{responseRatePct}"
		tone={responseRatePct === 0 ? 'danger' : responseRatePct >= 60 ? 'success' : 'warning'}
		caption="hedef %80"
		critical={responseRatePct === 0}
		delta={hs.responseStats.rateTrend}
		deltaUnit="pp"
		deltaPolarity="higher-better"
	/>
	{#if !hideComp}
		<StatTile
			label="Rakip Farkı"
			value={competitorGap !== null ? competitorGap.toFixed(1) : '—'}
			tone={competitorGap !== null && competitorGap < 0 ? 'danger' : 'neutral'}
			caption={competitorGap !== null && competitorGap < 0 ? 'rakip önde' : 'öndeyiz'}
		/>
	{/if}
</div>

<!-- ── Trend + Platforms/Categories row ──────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1.55fr_1fr]">
	<!-- Left column: reputation trend + platform comparison stacked. -->
	<div class="flex flex-col gap-3.5">
		<SectionCard title="İtibar trendi (GPI)" icon={TrendingUp} hint={trendHasHistory ? `son ${trendActual.length} dönem` : 'geçmiş birikiyor'}>
			{#snippet action()}
				{#if hs.gpi >= GPI_TARGET}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-success-light px-2.5 py-1 text-[11px] font-bold text-success">
						<CircleCheck size={13} strokeWidth={2.5} />Hedefte
					</span>
				{:else if hs.gpi >= GPI_TARGET - 3}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-text-2">
						<TrendingUp size={13} strokeWidth={2.5} />Hedefe çok yakın
					</span>
				{:else}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-bold text-warning">
						<TriangleAlert size={13} strokeWidth={2.5} />Hedefin altında
					</span>
				{/if}
			{/snippet}
			<div class="mb-3 flex flex-wrap gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-text-2"><i class="h-[3px] w-2.5 rounded-sm" style="background:var(--color-brand)"></i>Gerçekleşen GPI</span>
				<span class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-text-2"><i class="h-[3px] w-2.5 rounded-sm" style="background:var(--color-text-3)"></i>Hedef {GPI_TARGET}</span>
			</div>
			{#if trendHasHistory}
				<TrendChart actual={trendActual} periods={comparePeriods} daily={data.chartDaily} target={GPI_TARGET} ymin={trendYmin} ymax={trendYmax} height={210} />
			{:else}
				<p class="py-12 text-center text-[13px] text-text-3">
					Trend için yeterli geçmiş yok — güncel GPI <b class="text-text-1">{hs.gpi.toFixed(1)}</b>.
				</p>
			{/if}
		</SectionCard>

		<!-- Platform GPI comparison — our blended line emphasized over each platform. -->
		{#if hasCompare}
			<SectionCard title="Platform GPI karşılaştırması" icon={LineChart}>
				<MultiTrendChart series={compareSeries} periods={comparePeriods} daily={data.chartDaily} height={230} />
			</SectionCard>
		{/if}
	</div>

	<SectionCard title="Platformlar" icon={Globe} hint="tıkla → evren" class="h-full">
		<div class="-mx-1">
			{#each platforms as p (p.key)}
				<PlatformRow platform={p} onenter={enterPlatform} />
			{/each}
		</div>
		<div class="mb-2 mt-4 flex items-center gap-2 border-t border-border pt-3 text-[13px] font-bold text-text-1">
			<Activity size={15} class="text-text-3" strokeWidth={2} />Kategori hareketi
		</div>
		{#each topCategories as c (c.label)}
			<CategoryBar label={c.label} score={c.score} trend={c.trend} />
		{/each}
	</SectionCard>
</div>

<!-- ── Issues / Praises ──────────────────────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
	<SectionCard title="En çok bahsedilen sorunlar" icon={CircleAlert} hint="son 30 gün">
		<MentionList items={allIssues} tone="issue" total={hs.reviewCount} />
	</SectionCard>
	<SectionCard title="En çok övülenler" icon={ThumbsUp} hint="son 30 gün">
		<MentionList items={allPraises} tone="praise" total={hs.reviewCount} />
	</SectionCard>
</div>

<!-- ── Impact analysis: "neyi düzeltirsem GPI artar?" (REAL leverage) ─────── -->
<SectionCard title="Neyi düzeltirsem GPI artar?" icon={Rocket} hint="gerçek kaldıraç · hedef 85" class="mb-3.5">
	<ImpactList impact={data.impact ?? null} />
</SectionCard>

<!-- ── Management response analytics ──────────────────────────────────────── -->
<SectionCard title="Yanıt Yönetimi" icon={MessageCircleReply} hint="platform · duygu · pazar" class="mb-3.5">
	<ResponseAnalytics
		overallRate={hs.responseStats.rate}
		medianHours={hs.responseStats.medianResponseTimeHours}
		byPlatform={MOCK_OS_RESPONSE.byPlatform}
		bySentiment={MOCK_OS_RESPONSE.bySentiment}
		competitorAvgRate={MOCK_OS_RESPONSE.competitorAvgRate}
	/>
</SectionCard>

<!-- ── Audience segments: who is reviewing you (language + trip type) ──────── -->
<SectionCard title="Kitle profili" icon={PieChart} hint="dil · memnuniyet" class="mb-3.5">
	<SegmentBreakdown data={data.segments ?? null} venueGpi={hs.gpi} />
</SectionCard>

<!-- ── Departments ───────────────────────────────────────────────────────── -->
<SectionCard title="Departmanlar" icon={Users} hint="tıkla → ekip detayı">
	<div class="grid grid-cols-2 gap-1 sm:grid-cols-4">
		{#each MOCK_OS_DEPTS as d (d.key)}
			<DeptCard dept={d} onenter={enterDept} />
		{/each}
	</div>
</SectionCard>
