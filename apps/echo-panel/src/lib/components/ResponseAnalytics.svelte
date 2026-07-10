<!--
  ResponseAnalytics — management-response breakdown: response rate per platform
  and per sentiment, benchmarked against the market average. The blended rate +
  median time and the per-platform / per-sentiment breakdowns are all [REAL]
  (/v1/responses/stats). Only competitorAvgRate ("Pazar") is still [MOCK→radar]
  until radar serves a market response-rate benchmark.
-->
<script lang="ts">
	import type { ResponseRateRow } from '$lib/mock/os';

	interface Props {
		/** Blended response rate, 0..1 — [REAL]. */
		overallRate: number;
		/** Median response time in hours — [REAL], null if unknown. */
		medianHours: number | null;
		/** Per-platform breakdown — omit on a single-platform lens. */
		byPlatform?: ResponseRateRow[];
		bySentiment: ResponseRateRow[];
		/** Market average rate, 0..1 — [MOCK→radar]. */
		competitorAvgRate: number;
		/** Left-column label over the headline rate (default "Genel yanıt oranı"). */
		overallLabel?: string;
	}

	let {
		overallRate,
		medianHours,
		byPlatform,
		bySentiment,
		competitorAvgRate,
		overallLabel = 'Genel yanıt oranı'
	}: Props = $props();

	const GOAL = 0.8; // target response rate

	// Color a rate by how it compares to the goal.
	function rateColor(rate: number): string {
		return rate >= GOAL ? 'bg-success' : rate >= 0.6 ? 'bg-warning' : 'bg-danger';
	}
	function rateText(rate: number): string {
		return rate >= GOAL ? 'text-success' : rate >= 0.6 ? 'text-warning' : 'text-danger';
	}
	const pct = (r: number) => Math.round(r * 100);

	// vs market: positive = ahead of competitors.
	const vsMarket = $derived(Math.round((overallRate - competitorAvgRate) * 100));
</script>

<div class="grid grid-cols-1 gap-4 {byPlatform ? 'lg:grid-cols-[auto_1fr_1fr]' : 'lg:grid-cols-[auto_1fr]'}">
	<!-- Headline: overall rate + median time + vs market -->
	<div class="flex flex-col justify-center gap-2 lg:pr-4 lg:border-r lg:border-border">
		<div>
			<div class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">{overallLabel}</div>
			<div class="text-[34px] font-extrabold leading-none {rateText(overallRate)}">%{pct(overallRate)}</div>
		</div>
		<div class="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-text-2">
			<span>Medyan: <b class="text-text-1">{medianHours !== null ? `${medianHours} sa` : '—'}</b></span>
			<span>
				Pazar: <b class="text-text-1">%{pct(competitorAvgRate)}</b>
				<span class="font-semibold {vsMarket >= 0 ? 'text-success' : 'text-danger'}">
					({vsMarket >= 0 ? '+' : ''}{vsMarket}pp)
				</span>
			</span>
		</div>
	</div>

	<!-- Per-platform (omitted on single-platform lenses) -->
	{#if byPlatform}
		<div>
			<div class="mb-2 text-[12px] font-bold text-text-1">Platforma göre</div>
			<div class="flex flex-col gap-1.5">
				{#each byPlatform as r (r.key)}
					<div class="grid grid-cols-[6rem_1fr_2.4rem] items-center gap-2">
						<span class="truncate text-[11.5px] text-text-2" title={r.label}>{r.label}</span>
						<span class="h-2 overflow-hidden rounded-full bg-surface-2">
							<span class="block h-full rounded-full {rateColor(r.rate)}" style="width:{pct(r.rate)}%"></span>
						</span>
						<span class="text-right text-[11.5px] font-bold {rateText(r.rate)}">%{pct(r.rate)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Per-sentiment -->
	<div>
		<div class="mb-2 text-[12px] font-bold text-text-1">Duyguya göre</div>
		<div class="flex flex-col gap-1.5">
			{#each bySentiment as r (r.key)}
				<div class="grid grid-cols-[6rem_1fr_2.4rem] items-center gap-2">
					<span class="truncate text-[11.5px] text-text-2" title={r.label}>{r.label}</span>
					<span class="h-2 overflow-hidden rounded-full bg-surface-2">
						<span class="block h-full rounded-full {rateColor(r.rate)}" style="width:{pct(r.rate)}%"></span>
					</span>
					<span class="text-right text-[11.5px] font-bold {rateText(r.rate)}">%{pct(r.rate)}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Insight line: the most actionable gap. -->
{#if bySentiment.length > 0}
	{@const neg = bySentiment.find((r) => r.key === 'negative')}
	{#if neg && neg.rate < GOAL}
		<p class="mt-3 border-t border-border pt-2.5 text-[11.5px] text-text-3">
			⚠️ Olumsuz yorumların yalnızca <b class="text-danger">%{pct(neg.rate)}</b>'ine yanıt veriliyor —
			en kritik segment. Bu oranı yükseltmek itibarı en hızlı toparlar.
		</p>
	{/if}
{/if}
