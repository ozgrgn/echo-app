<!--
  Platform universe lens (prototype #view-ta). Real per-channel snapshot:
  hero + sub-tabs + sentiment distribution + real 14 categories + "önce neyi
  düzelt" leverage list. Distribution + leverage estimate are [MOCK→radar].
-->
<script lang="ts">
	import { CATEGORIES, gpiZone } from '@talkwo/echo-core';
	import { goto } from '$app/navigation';
	import { osState } from '$lib/stores/osState.svelte';

	import PlatformHero from '$lib/components/PlatformHero.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import CategoryBar from '$lib/components/CategoryBar.svelte';
	import OpportunityList from '$lib/components/OpportunityList.svelte';
	import ResponseAnalytics from '$lib/components/ResponseAnalytics.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import MentionExplorer from '$lib/components/MentionExplorer.svelte';
	import ResponseInbox from '$lib/components/ResponseInbox.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import {
		getMentions,
		getResponseStats,
		getResponseQueue,
		type MentionRow,
		type ResponseStats,
		type ResponseQueueItem
	} from '@talkwo/echo-ui';
	import { auth } from '$lib/stores/auth.svelte';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';
	import { PLATFORM_COLOR, responseSliceFor, platformTrendFor } from '$lib/mock/os';
	import { Activity, Rocket, ChartBar, ArrowLeft, MessageSquare, Swords, MessageCircleReply, TrendingUp } from '@lucide/svelte';

	let { data } = $props();
	const ps = $derived(data.platformScore);

	// Response analytics scoped to this platform — [MOCK→radar]. Overall rate seeds
	// from the blended responseStats; the sentiment split is derived per platform.
	const respSlice = $derived(responseSliceFor(data.platform, ps.responseStats?.rate ?? 0.7));

	// GPI trend — REAL per-platform series from /v1/scores/:slug/history. Falls back
	// to the synthetic generator only in mock mode (data.history null), so live never
	// invents a past.
	const trendActual = $derived(
		data.history && data.history.length > 0
			? data.history.map((p) => p.gpi)
			: platformTrendFor(data.platform, ps.gpi).actual
	);
	const trendHasHistory = $derived((data.history?.length ?? 0) > 1);
	const trendYmin = $derived(Math.floor(Math.min(...trendActual) - 4));
	const trendYmax = $derived(Math.ceil(Math.max(...trendActual) + 4));

	const PLATFORM_LABEL: Record<string, string> = {
		tripadvisor: 'TripAdvisor',
		booking: 'Booking',
		google: 'Google',
		holidaycheck: 'HolidayCheck'
	};
	const label = $derived(PLATFORM_LABEL[data.platform] ?? data.platform);

	// Back to the Genel lens — replaces the global LensTabs row on this page.
	function backToGenel() {
		osState.setLens({ kind: 'genel' });
		goto('/os');
	}

	// Quick switcher — jump between platform universes without going back to Genel.
	const ALL_PLATFORMS = ['tripadvisor', 'booking', 'google', 'holidaycheck'];
	function switchTo(p: string) {
		if (p === data.platform) return;
		osState.setLens({ kind: 'platform', platform: p as never });
		goto(`/os/platform/${p}`);
	}

	let activeTab = $state('genel');
	const tabs = ['Genel', 'Kategoriler', 'Yorumlar', 'Yanıtlar', 'Rakipler'];
	const color = $derived(PLATFORM_COLOR[data.platform as keyof typeof PLATFORM_COLOR] ?? '#64748b');

	// ── Semantic mentions (Yorumlar tab) — REAL data, lazily fetched ─────────
	let mentions = $state<MentionRow[]>([]);
	let mentionFilter = $state<'all' | 'negative' | 'positive'>('all');
	let mentionsLoading = $state(false);

	async function loadMentions() {
		// Mock mode: derive a few rows from the platform's real topIssues/praises so
		// the explorer isn't empty in demos. [MOCK→radar] for the full stream.
		if (osDataSource.isMock) {
			mentions = mockMentions(mentionFilter);
			return;
		}
		const { token, venueSlug } = auth;
		if (!token || !venueSlug) return;
		mentionsLoading = true;
		try {
			const res = await getMentions(
				venueSlug,
				{ limit: 60, ...(mentionFilter !== 'all' ? { polarity: mentionFilter } : {}) },
				token
			);
			// Backend is venue-wide; narrow to this platform client-side.
			mentions = res.items.filter((m) => m.platform === data.platform);
		} catch {
			mentions = [];
		} finally {
			mentionsLoading = false;
		}
	}

	// Fetch when the Yorumlar tab is active and (platform or filter) changes.
	$effect(() => {
		if (activeTab === 'yorumlar') {
			// reference reactive deps so the effect re-runs on change
			void data.platform;
			void mentionFilter;
			loadMentions();
		}
	});

	function setMentionFilter(f: 'all' | 'negative' | 'positive') {
		mentionFilter = f;
	}

	// ── Response management (Yanıtlar tab + Genel analytics) — REAL data ─────
	let respStats = $state<ResponseStats | null>(null);
	let queueItems = $state<ResponseQueueItem[]>([]);
	let queueLoading = $state(false);

	async function loadResponseStats() {
		if (osDataSource.isMock) {
			respStats = null; // Genel analytics falls back to the mock slice
			return;
		}
		const { token, venueSlug } = auth;
		if (!token || !venueSlug) return;
		try {
			respStats = await getResponseStats(venueSlug, token, data.platform);
		} catch {
			respStats = null;
		}
	}
	// Stats feed BOTH the Yanıtlar KPI strip and the Genel ResponseAnalytics card,
	// so they load on platform change, not on tab change.
	$effect(() => {
		void data.platform;
		loadResponseStats();
	});

	async function loadQueue() {
		if (osDataSource.isMock) {
			queueItems = mockQueue();
			return;
		}
		const { token, venueSlug } = auth;
		if (!token || !venueSlug) return;
		queueLoading = true;
		try {
			const res = await getResponseQueue(venueSlug, token, {
				platform: data.platform,
				limit: 100
			});
			queueItems = res.items;
		} catch {
			queueItems = [];
		} finally {
			queueLoading = false;
		}
	}
	$effect(() => {
		if (activeTab === 'yanıtlar') {
			void data.platform;
			loadQueue();
		}
	});

	// Genel tab analytics: real stats when live; the mock slice only in demo mode.
	// competitorAvgRate has no real source yet — stays [MOCK→radar] in both paths.
	const SENT_LABEL = { negative: 'Olumsuz', neutral: 'Nötr', positive: 'Olumlu' } as const;
	const respAnalytics = $derived(
		respStats
			? {
					overallRate: respStats.rate,
					medianHours: respStats.medianResponseTimeHours,
					bySentiment: respStats.bySentiment.map((s) => ({
						key: s.key,
						label: SENT_LABEL[s.key],
						rate: s.rate,
						responded: s.responded,
						total: s.total
					})),
					competitorAvgRate: respSlice.competitorAvgRate
				}
			: {
					overallRate: respSlice.overallRate,
					medianHours: ps.responseStats?.medianResponseTimeHours ?? null,
					bySentiment: respSlice.bySentiment,
					competitorAvgRate: respSlice.competitorAvgRate
				}
	);

	// Median hours reads better as days past 48h.
	function formatHours(h: number): string {
		return h >= 48 ? `${Math.round(h / 24)} gün` : `${h} sa`;
	}

	// Mock fallback: fabricate queue rows from the platform's real topIssues so
	// the inbox isn't empty in demos. [MOCK→radar] only in demo mode.
	function mockQueue(): ResponseQueueItem[] {
		const rows: ResponseQueueItem[] = [];
		let i = 0;
		for (const cs of ps.categoryScores) {
			for (const it of cs.topIssues ?? []) {
				i += 1;
				rows.push({
					id: `mock-resp-${i}`,
					platform: data.platform,
					publishedDate: '',
					rating: (i % 3) + 1,
					rating5: (i % 3) + 1,
					title: '',
					text: it.sampleExcerpt,
					lang: 'tr',
					author: 'Misafir',
					url: null,
					ageDays: i * 4,
					priority: Math.max(5, 92 - i * 13)
				});
			}
		}
		return rows.slice(0, 8);
	}

	// Mock fallback: build MentionRow[] from the platform score's real excerpts.
	function mockMentions(f: 'all' | 'negative' | 'positive'): MentionRow[] {
		const rows: MentionRow[] = [];
		for (const cs of ps.categoryScores) {
			for (const it of cs.topIssues ?? []) {
				rows.push({
					reviewId: `mock-${cs.category}-i-${it.subcategory}`,
					platform: data.platform,
					publishedDate: '',
					category: cs.category,
					subcategory: it.subcategory,
					sentiment: 'negative',
					polarity: -0.6,
					excerpt: it.sampleExcerpt,
					target_text: null
				});
			}
			for (const it of cs.topPraises ?? []) {
				rows.push({
					reviewId: `mock-${cs.category}-p-${it.subcategory}`,
					platform: data.platform,
					publishedDate: '',
					category: cs.category,
					subcategory: it.subcategory,
					sentiment: 'positive',
					polarity: 0.7,
					excerpt: it.sampleExcerpt,
					target_text: null
				});
			}
		}
		if (f === 'negative') return rows.filter((r) => r.polarity <= -0.2);
		if (f === 'positive') return rows.filter((r) => r.polarity >= 0.2);
		return rows;
	}

	// Real categories sorted by score (worst first feeds the opportunity list).
	const categories = $derived(
		[...ps.categoryScores]
			.sort((a, b) => b.mentionCount - a.mentionCount)
			.map((cs) => ({ label: CATEGORIES[cs.category].label, score: cs.headlineScore, trend: cs.trend }))
	);

	// "Önce neyi düzelt" — lowest-score × highest-mention = highest leverage.
	// lift is a [MOCK→radar] heuristic placeholder (real leverage math is radar's).
	const opportunities = $derived(
		[...ps.categoryScores]
			.filter((cs) => cs.mentionCount > 0)
			.map((cs) => ({
				cs,
				// crude leverage proxy: how far below 85 × mention weight
				leverage: (85 - cs.headlineScore) * Math.log10(cs.mentionCount + 1)
			}))
			.sort((a, b) => b.leverage - a.leverage)
			.slice(0, 3)
			.map((x, i) => ({
				rank: i + 1,
				label: CATEGORIES[x.cs.category].label,
				mentions: x.cs.mentionCount,
				score: x.cs.headlineScore,
				lift: `+${(x.leverage / 10).toFixed(1)}`
			}))
	);

	// Sentiment distribution — derive the 5-bucket SHARES from the aggregated
	// histograms, then scale to the platform's real reviewCount so the totals line
	// up with the "N yorum" header (summing raw mention histograms would massively
	// over-count, e.g. 14 categories × hundreds of mentions = thousands).
	const dist = $derived.by(() => {
		const sum = { strongPos: 0, pos: 0, neu: 0, neg: 0, strongNeg: 0 };
		for (const cs of ps.categoryScores) {
			const d = cs.distribution;
			sum.strongPos += d.strongPositiveCount;
			sum.pos += d.positiveCount;
			sum.neu += d.neutralCount;
			sum.neg += d.negativeCount;
			sum.strongNeg += d.strongNegativeCount;
		}
		const totalMentions = sum.strongPos + sum.pos + sum.neu + sum.neg + sum.strongNeg || 1;
		const reviews = ps.reviewCount;
		const scale = (n: number) => Math.round((n / totalMentions) * reviews);
		const rows = [
			{ label: 'Mükemmel', n: scale(sum.strongPos), color: 'var(--color-success)' },
			{ label: 'İyi', n: scale(sum.pos), color: '#65a30d' },
			{ label: 'Ortalama', n: scale(sum.neu), color: 'var(--color-warning)' },
			{ label: 'Kötü', n: scale(sum.neg), color: '#ea580c' },
			{ label: 'Berbat', n: scale(sum.strongNeg), color: 'var(--color-danger)' }
		];
		const max = Math.max(1, ...rows.map((r) => r.n));
		return { rows, max };
	});

</script>

<!-- Back to Genel + platform switcher on one row (replaces the global LensTabs). -->
<div class="mb-3.5 flex flex-wrap items-center gap-2">
	<!-- Back button — sits first, same row as the switcher pills. -->
	<button
		onclick={backToGenel}
		class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
	>
		<ArrowLeft size={15} strokeWidth={2} />
		Geri
	</button>
	<!-- Thin divider between back and the platform pills. -->
	<span class="mx-0.5 h-5 w-px bg-border"></span>
	{#each ALL_PLATFORMS as p (p)}
		{@const isActive = p === data.platform}
		{@const color = PLATFORM_COLOR[p as keyof typeof PLATFORM_COLOR]}
		<button
			onclick={() => switchTo(p)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{isActive ? 'border-transparent text-white' : 'border-border bg-surface-1 text-text-2 hover:bg-surface-2'}"
			style={isActive ? `background:${color}` : ''}
		>
			<span
				class="grid h-4 w-4 place-items-center rounded text-[9px] font-extrabold"
				style={isActive ? 'background:rgba(255,255,255,0.25);color:#fff' : `background:${color}1a;color:${color}`}
			>
				{PLATFORM_LABEL[p].slice(0, 1)}
			</span>
			{PLATFORM_LABEL[p]}
		</button>
	{/each}
</div>

<PlatformHero
	platform={data.platform}
	{label}
	gpi={ps.gpi}
	reviewCount={ps.reviewCount}
	blendedGpi={data.blended.gpi}
/>

<!-- Sub-tabs — active tab uses the platform brand color (prototype .ut.on). -->
<div class="mb-3.5 inline-flex rounded-[11px] bg-surface-2 p-1">
	{#each tabs as t (t)}
		{@const key = t.toLowerCase()}
		<button
			onclick={() => (activeTab = key)}
			class="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{activeTab === key ? 'bg-surface-1 shadow-card' : 'text-text-2'}"
			style={activeTab === key ? `color:${color}` : ''}
		>
			{t}
		</button>
	{/each}
</div>

{#if activeTab === 'genel'}
	<!-- GPI trend for this platform — REAL series from history (fallback in mock). -->
	<SectionCard title="İtibar trendi · {label}" icon={TrendingUp} hint={trendHasHistory ? `son ${trendActual.length} dönem` : 'güncel'} class="mb-3.5">
		{#if trendHasHistory}
			<TrendChart actual={trendActual} ymin={trendYmin} ymax={trendYmax} color={color} height={200} />
		{:else}
			<p class="py-10 text-center text-[13px] text-text-3">
				Bu platform için yeterli geçmiş yok — güncel GPI <b class="text-text-1">{ps.gpi.toFixed(1)}</b>.
			</p>
		{/if}
	</SectionCard>

	<!-- Genel — distribution + categories + opportunity (the full snapshot). -->
	<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.2fr]">
		<SectionCard title="Puan dağılımı" icon={ChartBar} hint="{ps.reviewCount} yorum">
			<div class="flex flex-col gap-1.5">
				{#each dist.rows as r (r.label)}
					<div class="grid grid-cols-[74px_1fr_36px] items-center gap-2.5">
						<span class="text-xs font-medium text-text-2">{r.label}</span>
						<span class="h-2 overflow-hidden rounded-full bg-surface-2">
							<span class="block h-full rounded-full" style="width:{(r.n / dist.max) * 100}%;background:{r.color}"></span>
						</span>
						<span class="text-right text-xs font-bold text-text-1">{r.n}</span>
					</div>
				{/each}
			</div>
		</SectionCard>

		<SectionCard title="Kategoriler · {label}" icon={Activity} hint="14 · ABSA">
			{#each categories.slice(0, 7) as c (c.label)}
				<CategoryBar label={c.label} score={c.score} trend={c.trend} />
			{/each}
		</SectionCard>
	</div>

	<SectionCard title="Önce neyi düzelt?" icon={Rocket} hint="en yüksek kaldıraç" class="mb-3.5">
		<OpportunityList items={opportunities} />
	</SectionCard>

	<!-- Response analytics scoped to this platform — REAL via /v1/responses/stats
	     when live (mock slice only in demo mode; market rate stays [MOCK→radar]). -->
	<SectionCard title="Yanıt Yönetimi · {label}" icon={MessageCircleReply} hint="duygu · pazar">
		<ResponseAnalytics
			overallRate={respAnalytics.overallRate}
			medianHours={respAnalytics.medianHours}
			bySentiment={respAnalytics.bySentiment}
			competitorAvgRate={respAnalytics.competitorAvgRate}
			overallLabel="{label} yanıt oranı"
		/>
	</SectionCard>
{:else if activeTab === 'kategoriler'}
	<!-- Kategoriler — full 14-category list, mention-sorted. -->
	<SectionCard title="Tüm kategoriler · {label}" icon={Activity} hint="{categories.length} · ABSA">
		{#each categories as c (c.label)}
			<CategoryBar label={c.label} score={c.score} trend={c.trend} />
		{/each}
	</SectionCard>
{:else if activeTab === 'yorumlar'}
	<!-- Yorumlar — sentence-level semantic mentions (REAL via /v1/mentions). -->
	<SectionCard title="Mentions · {label}" icon={MessageSquare} hint="cümle düzeyi · ABSA">
		<MentionExplorer
			items={mentions}
			filter={mentionFilter}
			onfilter={setMentionFilter}
			loading={mentionsLoading}
		/>
	</SectionCard>
{:else if activeTab === 'yanıtlar'}
	<!-- Yanıtlar — response triage inbox (REAL via /v1/responses/*). Display +
	     triage only; composing replies is a later phase. -->
	{#if respStats}
		<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
			<StatTile
				label="Yanıt oranı"
				value="%{Math.round(respStats.rate * 100)}"
				tone={respStats.rate >= 0.7 ? 'success' : 'warning'}
				caption="{respStats.withResponse}/{respStats.total} yorum"
			/>
			<StatTile
				label="Medyan yanıt süresi"
				value={respStats.medianResponseTimeHours != null
					? formatHours(respStats.medianResponseTimeHours)
					: '—'}
				caption={respStats.medianResponseTimeHours != null
					? `${respStats.responseTimeKnownCount} tarihli yanıttan`
					: 'kaynak yanıt tarihi vermiyor'}
			/>
			<StatTile
				label="Yanıtsız"
				value={String(respStats.unanswered.total)}
				tone={respStats.unanswered.total > 0 ? 'warning' : 'success'}
				caption="yanıt bekleyen yorum"
			/>
			<StatTile
				label="Yanıtsız negatif"
				value={String(respStats.unanswered.negative)}
				tone={respStats.unanswered.negative > 0 ? 'danger' : 'success'}
				caption="önce bunlar"
			/>
		</div>
	{/if}
	<SectionCard title="Yanıt bekleyenler · {label}" icon={MessageCircleReply} hint="en yanan üstte">
		<ResponseInbox items={queueItems} loading={queueLoading} />
	</SectionCard>
{:else if activeTab === 'rakipler'}
	<!-- Rakipler — per-platform competitor comparison. [MOCK→radar]. -->
	<SectionCard title="Rakipler · {label}" icon={Swords} hint="yakında">
		<p class="py-8 text-center text-[13px] text-text-3">
			Bu platformda rakip kıyaslaması
			<span class="font-medium text-text-2">Phase 2'de</span> radar verisiyle gelecek.<br />
			Genel rakip görünümü için <a href="/os/competitors" class="font-medium text-brand hover:underline">Rakipler lensine</a> gidin.
		</p>
	</SectionCard>
{/if}
