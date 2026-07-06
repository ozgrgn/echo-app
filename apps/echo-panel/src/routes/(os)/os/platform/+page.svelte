<!--
  Platform OVERVIEW lens (/os/platform index) — the super-dashboard entry that
  compares all channels side by side, instead of jumping straight into one:
    • blended context + per-channel GPI/review/response tiles (click → detail)
    • one shared GPI trend chart (all channels + our blended line)
    • per-category comparison grid (14 categories × channels)
  A channel tile deep-links into /os/platform/[platform] for the full universe.
  Per-platform competitor is still [MOCK→radar] (Phase 2) — see Session D.
-->
<script lang="ts">
	import { CATEGORIES, gpiZone } from '@talkwo/echo-core';
	import { goto } from '$app/navigation';
	import { osState } from '$lib/stores/osState.svelte';
	import { PLATFORM_COLOR } from '$lib/mock/os';
	import { Globe, TrendingUp, Layers, ChevronRight } from '@lucide/svelte';

	import SectionCard from '$lib/components/SectionCard.svelte';
	import MultiTrendChart from '$lib/components/MultiTrendChart.svelte';

	let { data } = $props();

	const PLATFORM_LABEL: Record<string, string> = {
		tripadvisor: 'TripAdvisor',
		booking: 'Booking',
		google: 'Google',
		holidaycheck: 'HolidayCheck'
	};
	const colorFor = (p: string) => PLATFORM_COLOR[p as keyof typeof PLATFORM_COLOR] ?? '#64748b';
	const labelFor = (p: string) => PLATFORM_LABEL[p] ?? p;

	// ── Channel tiles — REAL per-channel snapshot (blended shown first for context).
	const channels = $derived(data.channels);

	function enterPlatform(p: string) {
		osState.setLens({ kind: 'platform', platform: p as never });
		goto(`/os/platform/${p}`);
	}

	// ── Compare chart — each channel's GPI line + our blended line emphasized.
	// A channel only appears if it has ≥2 history points (filtered server-side).
	const compareSeries = $derived([
		...data.platformHistories.map((ph) => ({
			key: ph.platform,
			label: labelFor(ph.platform),
			color: colorFor(ph.platform),
			values: ph.points.map((p) => p.gpi),
			emphasis: false
		})),
		...((data.blendedHistory?.length ?? 0) > 1
			? [
					{
						key: 'all',
						label: 'GPI (genel)',
						color: 'var(--color-brand)',
						values: data.blendedHistory!.map((p) => p.gpi),
						emphasis: true
					}
				]
			: [])
	]);
	const hasCompare = $derived(compareSeries.length > 1);
	// Blended history is the longest, canonical x-axis.
	const comparePeriods = $derived((data.blendedHistory ?? []).map((p) => p.period));

	// ── Per-category comparison — 14 taxonomy rows × the channels we have snapshots
	// for. Each cell is that channel's headlineScore for the category (— when the
	// category has no mentions on that channel). Data already rides in categoryScores.
	type Cell = { score: number | null };
	const catRows = $derived(
		// Union of categories present across channels, in taxonomy order.
		Object.values(CATEGORIES)
			.map((meta) => {
				const cells: Record<string, Cell> = {};
				for (const ch of channels) {
					const cs = ch.score.categoryScores.find((c) => c.category === meta.key);
					cells[ch.platform] = { score: cs && cs.mentionCount > 0 ? cs.headlineScore : null };
				}
				const anyScored = Object.values(cells).some((c) => c.score != null);
				return { key: meta.key, label: meta.label, cells, anyScored };
			})
			.filter((r) => r.anyScored)
	);

	function zoneClass(score: number | null): string {
		if (score == null) return 'text-text-3';
		const z = gpiZone(score);
		return z === 'green' ? 'text-success' : z === 'yellow' ? 'text-warning' : 'text-danger';
	}
</script>

<!-- Header — this is the overview, not one channel. -->
<div class="mb-4 flex items-center gap-2.5">
	<span class="grid h-9 w-9 place-items-center rounded-xl bg-text-1 text-white">
		<Globe size={18} strokeWidth={2} />
	</span>
	<div>
		<h1 class="text-lg font-bold text-text-1">Platformlar</h1>
		<p class="text-[12.5px] text-text-3">
			Tüm kanalların karşılaştırması · genel GPI <b class="text-text-1">{data.blended.gpi.toFixed(1)}</b>
		</p>
	</div>
</div>

<!-- Channel tiles — click a channel to enter its universe. -->
<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
	{#each channels as ch (ch.platform)}
		{@const c = colorFor(ch.platform)}
		<button
			onclick={() => enterPlatform(ch.platform)}
			class="group flex flex-col gap-1 rounded-2xl border border-border bg-surface-1 p-4 text-left shadow-card transition-colors hover:bg-surface-2"
		>
			<span class="flex items-center gap-2">
				<span
					class="grid h-6 w-6 place-items-center rounded-lg text-[11px] font-extrabold"
					style="background:{c}1a;color:{c}"
				>
					{labelFor(ch.platform).slice(0, 1)}
				</span>
				<span class="text-[12.5px] font-bold text-text-1">{labelFor(ch.platform)}</span>
				<ChevronRight size={14} class="ml-auto text-text-3 transition-transform group-hover:translate-x-0.5" />
			</span>
			<span class="text-2xl font-extrabold {zoneClass(ch.score.gpi)}">{ch.score.gpi.toFixed(1)}</span>
			<span class="text-xs text-text-3">
				{ch.score.reviewCount} yorum · yanıt %{Math.round((ch.score.responseStats?.rate ?? 0) * 100)}
			</span>
		</button>
	{/each}
</div>

<!-- Shared GPI trend across channels. -->
<SectionCard title="İtibar trendi · tüm kanallar" icon={TrendingUp} hint="son 24 dönem" class="mb-3.5">
	{#if hasCompare}
		<MultiTrendChart series={compareSeries} periods={comparePeriods} height={240} />
	{:else}
		<p class="py-10 text-center text-[13px] text-text-3">
			Karşılaştırma için henüz yeterli kanal geçmişi yok — kanallar analiz edildikçe dolar.
		</p>
	{/if}
</SectionCard>

<!-- Per-category comparison across channels. -->
<SectionCard title="Kategori karşılaştırması" icon={Layers} hint="{catRows.length} kategori · GPI">
	{#if channels.length === 0 || catRows.length === 0}
		<p class="py-8 text-center text-[13px] text-text-3">Bu dönemde kanal bazlı kategori verisi yok.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-[13px]">
				<thead>
					<tr class="text-text-3">
						<th class="py-2 pr-3 text-left font-semibold">Kategori</th>
						{#each channels as ch (ch.platform)}
							<th class="px-3 py-2 text-right font-semibold" style="color:{colorFor(ch.platform)}">
								{labelFor(ch.platform)}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each catRows as row (row.key)}
						<tr class="border-t border-border">
							<td class="py-2 pr-3 font-medium text-text-1">{row.label}</td>
							{#each channels as ch (ch.platform)}
								{@const cell = row.cells[ch.platform]}
								<td class="px-3 py-2 text-right font-bold tabular-nums {zoneClass(cell?.score ?? null)}">
									{cell?.score != null ? cell.score.toFixed(1) : '—'}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</SectionCard>
