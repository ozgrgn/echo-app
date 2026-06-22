<!--
  ECHO OS — Genel lens (the "Gündem" view). Real fields (gpi/rpi/categoryScores…)
  from getHotelScore; series/platform/dept from lib/mock/os (labeled [MOCK→…] in
  ECHO_OS_DATA.md). Built from the shared primitives (StatTile/TrendChart/…).
-->
<script lang="ts">
	import { CATEGORIES, gpiZone, getSubcategoryLabel } from '@talkwo/echo-core';
	import { goto } from '$app/navigation';
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
	import { TrendingUp, Globe, Activity, Users, CircleAlert, ThumbsUp, TriangleAlert, MessageCircleReply, PieChart } from '@lucide/svelte';

	import {
		MOCK_OS_DEPTS,
		MOCK_OS_RESPONSE,
		type OsPlatform
	} from '$lib/mock/os';

	let { data } = $props();
	const hs = $derived(data.hotelScore);

	// ── GPI trend — REAL series from /v1/scores/:slug/history (backfilled snapshots).
	// Falls back to a single point (today's GPI) when history is missing/empty, so
	// the chart never invents a past. Target line is the only [MOCK→echo] piece.
	const GPI_TARGET = 75;
	const historyGpi = $derived((data.history ?? []).map((p) => p.gpi));
	const trendActual = $derived(historyGpi.length > 0 ? historyGpi : [hs.gpi]);
	const trendYmin = $derived(Math.floor(Math.min(...trendActual, GPI_TARGET) - 4));
	const trendYmax = $derived(Math.ceil(Math.max(...trendActual, GPI_TARGET) + 4));
	const trendHasHistory = $derived(historyGpi.length > 1);

	// Real KPI sparklines + deltas from history (GPI, review count). Last-vs-previous
	// point = the delta. Series capped to the trailing 8 points for a compact spark.
	const spark = (arr: number[]) => arr.slice(-8);
	const lastDelta = (arr: number[]) =>
		arr.length >= 2 ? +(arr[arr.length - 1] - arr[arr.length - 2]).toFixed(1) : 0;
	const historyReviews = $derived((data.history ?? []).map((p) => p.reviewCount));
	const gpiSpark = $derived(spark(historyGpi));
	const gpiDelta = $derived(lastDelta(historyGpi));
	const reviewSpark = $derived(spark(historyReviews));
	const reviewDelta = $derived(lastDelta(historyReviews));

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

	// Period segmented control (weekly/monthly) — UI state in the shared store.
	const period = $derived(osState.period);

	// KPI values: [REAL] from HotelScore; deltas/series [MOCK→radar] from MOCK_OS_KPIS.
	const responseRatePct = $derived(Math.round(hs.responseStats.rate * 100));
	const competitorGap = $derived(hs.rpi !== null ? +(hs.gpi - hs.rpi).toFixed(1) : null);

	// Category movement — [REAL] top categories by mention.
	const topCategories = $derived(
		[...hs.categoryScores]
			.sort((a, b) => b.mentionCount - a.mentionCount)
			.slice(0, 6)
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
		<div class="inline-flex self-center rounded-[10px] bg-surface-2 p-[3px]">
			{#each [{ k: 'weekly', l: 'Haftalık' }, { k: 'monthly', l: 'Aylık' }] as opt (opt.k)}
				<button
					onclick={() => osState.setPeriod(opt.k as 'weekly' | 'monthly')}
					class="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors
						{period === opt.k ? 'bg-surface-1 text-text-1 shadow-card' : 'text-text-2'}"
				>
					{opt.l}
				</button>
			{/each}
		</div>
		<div class="flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Genel GPI</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight {gpiTextClass}">{hs.gpi.toFixed(1)}</span>
		</div>
	</div>
</div>

<!-- ── KPI strip ─────────────────────────────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
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
	<StatTile
		label="RPI"
		value={hs.rpi?.toFixed(1) ?? '—'}
		caption="rakip endeksi"
	/>
	<StatTile
		label="Toplam Yorum"
		value={hs.reviewCount.toLocaleString('tr-TR')}
		caption={reviewDelta !== 0 ? `geçen dönem ${(hs.reviewCount - reviewDelta).toLocaleString('tr-TR')}` : 'bu dönem'}
		delta={reviewDelta}
		deltaPolarity="higher-better"
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
	<StatTile
		label="Rakip Farkı"
		value={competitorGap !== null ? competitorGap.toFixed(1) : '—'}
		tone={competitorGap !== null && competitorGap < 0 ? 'danger' : 'neutral'}
		caption={competitorGap !== null && competitorGap < 0 ? 'rakip önde' : 'öndeyiz'}
	/>
</div>

<!-- ── Trend + Platforms/Categories row ──────────────────────────────────── -->
<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
	<SectionCard title="İtibar trendi (GPI)" icon={TrendingUp} hint={trendHasHistory ? `son ${trendActual.length} dönem` : 'geçmiş birikiyor'}>
		{#snippet action()}
			{#if hs.gpi < GPI_TARGET}
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
			<TrendChart
				actual={trendActual}
				target={GPI_TARGET}
				ymin={trendYmin}
				ymax={trendYmax}
				height={230}
			/>
		{:else}
			<p class="py-12 text-center text-[13px] text-text-3">
				Trend için yeterli geçmiş yok — güncel GPI <b class="text-text-1">{hs.gpi.toFixed(1)}</b>.
				Her dönem yeni snapshot biriktikçe çizgi oluşacak.
			</p>
		{/if}
	</SectionCard>

	<SectionCard title="Platformlar" icon={Globe} hint="tıkla → evren">
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
<SectionCard title="Kitle profili" icon={PieChart} hint="dil · seyahat tipi" class="mb-3.5">
	<SegmentBreakdown data={data.segments ?? null} />
</SectionCard>

<!-- ── Departments ───────────────────────────────────────────────────────── -->
<SectionCard title="Departmanlar" icon={Users} hint="tıkla → ekip detayı">
	<div class="grid grid-cols-2 gap-1 sm:grid-cols-4">
		{#each MOCK_OS_DEPTS as d (d.key)}
			<DeptCard dept={d} onenter={enterDept} />
		{/each}
	</div>
</SectionCard>
