<!--
  ECHO OS — Genel lens (the "Gündem" view). Real fields (gpi/rpi/categoryScores/
  history/platforms/impact/responses/segments) from the loader; departments from
  GET /v1/departments/:slug. lib/mock/os now only supplies the platform color
  palette. Built from the shared primitives (StatTile/TrendChart/…).
-->
<script lang="ts">
	import { CATEGORIES, gpiZone, getSubcategoryLabel } from '@talkwo/echo-core';
	import { type DepartmentScore } from '@talkwo/echo-ui';
	import { goto } from '$app/navigation';
	import { hidesCompetitors, parseOsWindow, windowParam, OS_WINDOW_TABS } from '$lib/config/window';
	import { osState } from '$lib/stores/osState.svelte';

	import StatTile from '$lib/components/StatTile.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import PlatformRow from '$lib/components/PlatformRow.svelte';
	import CategoryBar from '$lib/components/CategoryBar.svelte';
	import CategorySentimentBar from '$lib/components/CategorySentimentBar.svelte';
	import MentionList from '$lib/components/MentionList.svelte';
	import DeptCard from '$lib/components/DeptCard.svelte';
	import ResponseAnalytics from '$lib/components/ResponseAnalytics.svelte';
	import SegmentBreakdown from '$lib/components/SegmentBreakdown.svelte';
	import MultiTrendChart from '$lib/components/MultiTrendChart.svelte';
	import ImpactList from '$lib/components/ImpactList.svelte';
	import { TrendingUp, Globe, Activity, Users, CircleAlert, ThumbsUp, TriangleAlert, CircleCheck, MessageCircleReply, PieChart, LineChart, Rocket } from '@lucide/svelte';

	import {
		PLATFORM_COLOR,
		type OsPlatform,
		type OsDept
	} from '$lib/mock/os';

	let { data } = $props();
	const hs = $derived(data.hotelScore);

	// ── EXPERIMENT (2026-07, revertible): "Kategori hareketi" shows RAW positive/
	// negative mention counts + a split green/red ratio bar + the 30-day (pure-aspect)
	// trend arrow — instead of a single opaque star-anchored score. Rationale: a score
	// like "79" is derived and un-auditable ("is it right?"), and a lone ↓ reads as
	// alarm; "142 pos / 31 neg, ↓ last 30d" is concrete, checkable, and gives the arrow
	// context. Counts come straight from cs.distribution (already in every snapshot).
	// Set false to restore the score bars — delete this flag + the CategorySentimentBar
	// usage to fully revert. Neutral bucket is excluded on purpose.
	const CATEGORY_MOVEMENT_SENTIMENT = true;

	// ── GPI trend — REAL series from /v1/scores/:slug/history (backfilled snapshots).
	// Falls back to a single point (today's GPI) when history is missing/empty, so
	// the chart never invents a past.
	//
	// The target comes from the backend (impact.target — scores/impact.ts DEFAULT_TARGET).
	// It used to be a hard-coded 70 here while the backend computed every "lift to target"
	// against 85: the chart drew one goal line and the "fastest route to target" card was
	// solving for a different one, on the same screen. Read it from the data so the two
	// can't drift again.
	const GPI_TARGET = $derived(data.impact?.target ?? 85);
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

	// Real KPI sparklines + deltas from history (GPI, review count).
	// Trailing-8 slice. Generic because the same window must be applied to the value
	// series AND to its period labels, so the two stay index-aligned.
	const spark = <T,>(arr: T[]): T[] => arr.slice(-8);
	// Per-period NEW reviews (published in the gap since the previous point) — always ≥0.
	const historyNewReviews = $derived((data.history ?? []).map((p) => p.newReviews ?? 0));

	// ────────────────────────────────────────────────────────────────────────
	// GPI delta — the COHORT trend from the backend (recent-30d vs prior-30d PUBLISHED
	// reviews), window-independent, the SAME signal as every category/department arrow.
	// Not a series diff: the old deltaOverDays compared today's rolling average to the
	// one 30 days ago, whose change mostly reflected OLD reviews leaving the window, not
	// new sentiment — and it varied by window. hs.gpiTrend is stamped by scoring's
	// injectCohortTrend so all arrows answer one question. See COHORT_TREND_TASARIM.md.
	const gpiSpark = $derived(spark(historyGpi));
	// hs.gpiTrend (positive-share / memnun-oranı shift, last 30d) is intentionally NOT shown
	// as the GPI card's delta — it's a different unit and read as a GPI-point drop. It's a
	// real, seasonally-adjusted satisfaction signal that deserves its own surface later
	// (e.g. a "Memnuniyet Trendi" indicator), not the GPI badge. (GPI_SAF_ASPECT_PLAN.md.)
	const reviewSpark = $derived(spark(historyNewReviews));
	// "This period" = new reviews in the newest point's gap (not a delta).
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
	// (competitorGap removed with the "Rakip Farkı" card — RPI already carries the comparison.)

	// In the 'max' (Tümü) lens competitor comparison is hidden — an owned venue's full
	// history isn't comparable to a competitor's ~2 analyzed years (owner decision).
	// Drop the RPI + Rakip Farkı KPI cards; the strip collapses 5→3.
	const hideComp = $derived(hidesCompetitors(parseOsWindow(data.window)));

	// Honest volume label: reviewCount is WINDOW-scoped (reviews published in the
	// lookback), not a lifetime total. Calling it "Toplam Yorum" at 3mo would present
	// ~500 as the hotel's total. Only 'max' is a true lifetime count.
	const curWindow = $derived(parseOsWindow(data.window));
	const windowLabel = $derived(OS_WINDOW_TABS.find((t) => t.key === curWindow)?.label ?? '');
	const reviewCountLabel = $derived(curWindow === 'max' ? 'Toplam Yorum' : `Yorum (${windowLabel})`);
	// The issues/praises lists aggregate mentions across the SELECTED window (not a fixed
	// 30 days — the old hardcoded "son 30 gün" hint was wrong: at 2Y these counts span two
	// years). Label follows the window so it can't drift from the data again.
	const mentionPeriodLabel = $derived(curWindow === 'max' ? 'tüm dönem' : windowLabel.toLocaleLowerCase('tr-TR'));

	// Category movement — [REAL] top categories by mention.
	// Category movement — declining categories first (most actionable), then by
	// mention volume. Shows more rows so the column matches the left stack's height.
	// "Kategori hareketi" — rank by MAGNITUDE of movement (biggest change first, up OR
	// down), so a real rise (BEACH/FRONT) is as visible as a drop. The old sort forced
	// decliners to the top and slice(0,10) then HID the risers, making a seasonally-down
	// month read as "everything red". Flat/below-floor (trend 0) sort last.
	const topCategories = $derived(
		[...hs.categoryScores]
			.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend) || b.mentionCount - a.mentionCount)
			.map((cs) => ({
				label: CATEGORIES[cs.category].label,
				score: cs.headlineScore,
				trend: cs.trend,
				// Raw positive/negative mention counts (neutral excluded) for the
				// sentiment-ratio bar. strong buckets fold into their side.
				pos: cs.distribution.positiveCount + cs.distribution.strongPositiveCount,
				neg: cs.distribution.negativeCount + cs.distribution.strongNegativeCount
			}))
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

	// ── Departments — REAL (GET /v1/departments/:slug via the OS data proxy) ────
	// Mention-level scores routed by the granular catalog (granular_key → owner_key).
	// This is the ONLY source now: the MOCK_OS_DEPTS fallback (invented scores from
	// before the routing map existed) is gone, so no data means the empty state below,
	// not eight fake departments.
	let realDepts = $state<DepartmentScore[] | null>(null);

	async function loadDepts(window: string | undefined) {
		try {
			const qs = new URLSearchParams({ resource: 'departments', ...(window ? { window } : {}) });
			const r = await fetch(`/api/os/data?${qs}`);
			const res = r.ok ? await r.json() : { departments: [] };
			realDepts = res.departments;
		} catch {
			realDepts = null;
		}
	}
	// `data.window` comes from the loader, so it already tracks the rail's ?window=.
	$effect(() => {
		loadDepts(windowParam(parseOsWindow(data.window)));
	});

	function toOsDept(d: DepartmentScore): OsDept {
		return {
			key: d.key,
			label: d.label,
			score: d.score,
			trend: d.trend > 0 ? 'up' : d.trend < 0 ? 'down' : 'flat',
			trendValue: d.trend,
			scope: d.categories.join(' · '),
			enters: d.score != null,
			mentions: d.mentionCount ?? null
		};
	}

	// Real list only — empty until the departments endpoint answers. A department with a
	// null score (not enough mentions in this window) is KEPT and rendered as a thin
	// "veri az · N mention" tile (scored first, thin last) — never a red 0, and never
	// silently dropped: on the 6mo default a dept the guest DID mention must not vanish.
	const depts = $derived<OsDept[]>(
		realDepts
			? realDepts
					.map(toOsDept)
					.sort((a, b) => (a.score == null ? 1 : 0) - (b.score == null ? 1 : 0))
			: []
	);
</script>

<!-- ── Venue hero: neutral band, same skeleton as PlatformHero so lenses align ── -->
<div class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border border-border bg-surface-1 p-5 shadow-card">
	<div class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] bg-gradient-to-br from-[#4f46e5] to-[#a855f7] text-[17px] font-extrabold text-white">
		{hs.venueName.slice(0, 1)}
	</div>
	<div class="min-w-0">
		<div class="text-base font-extrabold tracking-tight text-text-1">{hs.venueName}</div>
		<!-- Region + season were hardcoded to one customer's venue and are not in the
		     score payload; the subtitle now states only what the data actually says.
		     The count is window-scoped, so say which window it covers. -->
		<div class="mt-0.5 text-xs text-text-3">
			{hs.reviewCount.toLocaleString('tr-TR')} yorum{curWindow === 'max' ? '' : ` · ${windowLabel.toLocaleLowerCase('tr-TR')}`}
		</div>
	</div>

	<div class="ml-auto flex items-end gap-4">
		<div class="flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Genel GPI</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight {gpiTextClass}">{hs.gpi.toFixed(1)}</span>
		</div>
	</div>
</div>

<!-- ── KPI strip ─────────────────────────────────────────────────────────── -->
<!-- Cards: GPI + Yorum + Yanıt + Yıldız always (4); RPI adds a 5th when competitors exist. -->
<div class="mb-3.5 grid grid-cols-2 gap-3.5 {hideComp ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}">
	<!-- Yıldız Ortalaması FIRST — the market number the owner is proud of (OTA star, silent
	     reviews included). Leads so the eye lands on the "iyi hissettiren" number, then GPI
	     right beside it as the action metric. Two universes, side by side
	     (GPI_SAF_ASPECT_PLAN.md): Yıldız = market/reputation, GPI = review content/aspect. -->
	<StatTile
		label="Yıldız Ortalaması"
		value={hs.avgStarRating != null ? `${hs.avgStarRating.toFixed(1)}` : '—'}
		tone="success"
		emphasis="primary"
		stars={hs.avgStarRating ?? undefined}
		caption="OTA ortalaması · 5 üzerinden"
	/>
	<!-- No delta badge on the GPI card: gpiTrend is the positive-share (memnun-oranı) shift,
	     NOT a GPI-point change — showing it beside the GPI value read as "GPI fell 14.5",
	     which is false (GPI is a snapshot, it didn't move). The satisfaction-trend signal is
	     real and belongs elsewhere (its own surface), not as the GPI card's badge.
	     (GPI_SAF_ASPECT_PLAN.md.) -->
	<StatTile
		label="Genel GPI"
		value={hs.gpi.toFixed(1)}
		tone={zoneTone(hs.gpi)}
		caption="içerik analizi · hedef {GPI_TARGET}"
		trend={gpiSpark}
		trendMinSpan={2}
		title="Son dönem GPI seyri"
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
		label={reviewCountLabel}
		value={hs.reviewCount.toLocaleString('tr-TR')}
		caption={reviewDelta > 0 ? `bu dönem +${reviewDelta.toLocaleString('tr-TR')} yeni` : 'bu dönem'}
		trend={reviewSpark}
	/>
	<!-- No delta badge: responseStats.rateTrend is hardcoded 0 in scoring (score.ts,
	     "0 until that lands") — a permanently frozen "0.0pp" reads as a real signal.
	     Re-add the delta when the trend is actually computed. -->
	<StatTile
		label="Yanıt Oranı"
		value="%{responseRatePct}"
		tone={responseRatePct === 0 ? 'danger' : responseRatePct >= 60 ? 'success' : 'warning'}
		caption="hedef %80"
		critical={responseRatePct === 0}
	/>
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
			{#if CATEGORY_MOVEMENT_SENTIMENT}
				<!-- Counts follow the selected window; arrows always compare the last 30 days
				     (window-independent cohort). Label makes the two time scales explicit. -->
				<span class="ml-auto text-[11px] font-medium text-text-3">Trendler · son 30 gün</span>
			{/if}
		</div>
		{#each topCategories as c (c.label)}
			{#if CATEGORY_MOVEMENT_SENTIMENT}
				<CategorySentimentBar label={c.label} pos={c.pos} neg={c.neg} trend={c.trend} />
			{:else}
				<CategoryBar label={c.label} score={c.score} trend={c.trend} />
			{/if}
		{/each}
	</SectionCard>
</div>

<!-- ── Issues / Praises ──────────────────────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
	<SectionCard title="En çok bahsedilen sorunlar" icon={CircleAlert} hint={mentionPeriodLabel}>
		<MentionList items={allIssues} tone="issue" total={hs.reviewCount} />
	</SectionCard>
	<SectionCard title="En çok övülenler" icon={ThumbsUp} hint={mentionPeriodLabel}>
		<MentionList items={allPraises} tone="praise" total={hs.reviewCount} />
	</SectionCard>
</div>

<!-- ── Impact analysis: "neyi düzeltirsem GPI artar?" (REAL leverage) ─────── -->
<SectionCard title="Neyi düzeltirsem GPI artar?" icon={Rocket} hint="gerçek kaldıraç · hedef 85" class="mb-3.5">
	<ImpactList impact={data.impact ?? null} />
</SectionCard>

<!-- ── Management response analytics ──────────────────────────────────────── -->
<!-- responseBreakdown is null when /v1/responses/stats is unreachable — show an honest
     empty state, never a fabricated breakdown (the old fallback served mock rows). -->
<SectionCard title="Yanıt Yönetimi" icon={MessageCircleReply} hint="platform · duygu · pazar" class="mb-3.5">
	{#if data.responseBreakdown}
		<ResponseAnalytics
			overallRate={hs.responseStats.rate}
			medianHours={hs.responseStats.medianResponseTimeHours}
			byPlatform={data.responseBreakdown.byPlatform}
			bySentiment={data.responseBreakdown.bySentiment}
			competitorAvgRate={data.responseBreakdown.competitorAvgRate}
		/>
	{:else}
		<p class="py-6 text-center text-[12px] text-text-3">
			Yanıt istatistikleri şu anda yüklenemedi — sayfayı yenileyin.
		</p>
	{/if}
</SectionCard>

<!-- ── Audience segments: who is reviewing you (language + trip type) ──────── -->
<SectionCard title="Kitle profili" icon={PieChart} hint="dil · memnuniyet" class="mb-3.5">
	<SegmentBreakdown data={data.segments ?? null} venueGpi={hs.gpi} />
</SectionCard>

<!-- ── Departments ───────────────────────────────────────────────────────── -->
<SectionCard title="Departmanlar" icon={Users} hint="tıkla → ekip detayı">
	{#if depts.length === 0}
		<p class="px-1 py-2 text-sm text-text-3">
			Departman skoru henüz yok — yorumlar departmanlara yönlendirildikçe dolar.
		</p>
	{:else}
		<div class="grid grid-cols-2 gap-1 sm:grid-cols-4">
			{#each depts as d (d.key)}
				<DeptCard dept={d} onenter={enterDept} />
			{/each}
		</div>
	{/if}
</SectionCard>
