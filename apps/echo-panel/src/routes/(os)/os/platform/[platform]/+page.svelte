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
	import { PLATFORM_COLOR, responseSliceFor, platformTrendFor } from '$lib/mock/os';
	import { Activity, Rocket, ChartBar, ArrowLeft, MessageSquare, Swords, MessageCircleReply, TrendingUp } from '@lucide/svelte';

	let { data } = $props();
	const ps = $derived(data.platformScore);

	// Response analytics scoped to this platform — [MOCK→radar]. Overall rate seeds
	// from the blended responseStats; the sentiment split is derived per platform.
	const respSlice = $derived(responseSliceFor(data.platform, ps.responseStats?.rate ?? 0.7));

	// GPI trend series for this platform — [MOCK→radar], lands on the real GPI.
	const trend = $derived(platformTrendFor(data.platform, ps.gpi));

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
	const tabs = ['Genel', 'Kategoriler', 'Yorumlar', 'Rakipler'];
	const color = $derived(PLATFORM_COLOR[data.platform as keyof typeof PLATFORM_COLOR] ?? '#64748b');

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
	<!-- GPI trend for this platform — [MOCK→radar], lands on the real current GPI. -->
	<SectionCard title="İtibar trendi · {label}" icon={TrendingUp} hint="GPI · son dönem" class="mb-3.5">
		<TrendChart actual={trend.actual} ymin={trend.ymin} ymax={trend.ymax} color={color} height={200} />
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

	<!-- Response analytics scoped to this platform (single-platform → no byPlatform). -->
	<SectionCard title="Yanıt Yönetimi · {label}" icon={MessageCircleReply} hint="duygu · pazar">
		<ResponseAnalytics
			overallRate={respSlice.overallRate}
			medianHours={ps.responseStats?.medianResponseTimeHours ?? null}
			bySentiment={respSlice.bySentiment}
			competitorAvgRate={respSlice.competitorAvgRate}
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
	<!-- Yorumlar — per-platform review explorer. [MOCK→radar] until the review
	     stream is wired into this lens. -->
	<SectionCard title="Yorumlar · {label}" icon={MessageSquare} hint="yakında">
		<p class="py-8 text-center text-[13px] text-text-3">
			Bu platformun cümle düzeyli yorum gezgini
			<span class="font-medium text-text-2">Phase 2'de</span> gelecek.
		</p>
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
