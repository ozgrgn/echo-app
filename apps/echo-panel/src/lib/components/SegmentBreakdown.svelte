<!--
  SegmentBreakdown — "who is reviewing you": distribution by language and by trip
  type. REAL data from GET /v1/segments. OTA data is sparse (many reviews carry
  neither), so shares are computed over the KNOWN subset and the unknown count is
  shown honestly as a footnote rather than padding the bars.
-->
<script lang="ts">
	import type { SegmentsResponse, SegmentBucket } from '@talkwo/echo-ui';
	import { Languages, Users } from '@lucide/svelte';

	interface Props {
		data: SegmentsResponse | null;
		loading?: boolean;
	}
	let { data, loading = false }: Props = $props();

	const LANG_LABEL: Record<string, string> = {
		en: 'İngilizce', tr: 'Türkçe', de: 'Almanca', ru: 'Rusça',
		pl: 'Lehçe', sr: 'Sırpça', fr: 'Fransızca', nl: 'Hollandaca', ar: 'Arapça'
	};
	const TRIP_LABEL: Record<string, string> = {
		FAMILY: 'Aile', COUPLES: 'Çiftler', FRIENDS: 'Arkadaşlar',
		SOLO: 'Tek başına', BUSINESS: 'İş'
	};

	// Known buckets only (drop 'unknown'), sorted desc, share over known total.
	function known(buckets: SegmentBucket[], knownTotal: number, labels: Record<string, string>) {
		const rows = buckets
			.filter((b) => b.key !== 'unknown')
			.map((b) => ({
				key: b.key,
				label: labels[b.key] ?? b.key,
				count: b.count,
				pct: knownTotal > 0 ? Math.round((b.count / knownTotal) * 100) : 0
			}))
			.sort((a, b) => b.count - a.count);

		// Long-tail collapse: keep the top entries, fold the rest into "Diğer" so the
		// list stays readable instead of showing a dozen %0 rows (e.g. 21 languages).
		const TOP = 6;
		if (rows.length <= TOP + 1) return rows;
		const head = rows.slice(0, TOP);
		const tail = rows.slice(TOP);
		const tailCount = tail.reduce((s, r) => s + r.count, 0);
		head.push({
			key: '__other__',
			label: `Diğer (${tail.length})`,
			count: tailCount,
			pct: knownTotal > 0 ? Math.round((tailCount / knownTotal) * 100) : 0
		});
		return head;
	}

	const langs = $derived(data ? known(data.byLanguage, data.languageKnown, LANG_LABEL) : []);
	const trips = $derived(data ? known(data.byTripType, data.tripTypeKnown, TRIP_LABEL) : []);
</script>

{#if loading}
	<p class="px-1 py-6 text-center text-sm text-text-3">Yükleniyor…</p>
{:else if !data}
	<p class="px-1 py-6 text-center text-sm text-text-3">Segment verisi yok.</p>
{:else}
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<!-- Language -->
		<div>
			<div class="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-1">
				<Languages size={14} class="text-text-3" strokeWidth={2} /> Dil
			</div>
			{#if langs.length === 0}
				<p class="py-3 text-[12px] text-text-3">Dil etiketli yorum yok.</p>
			{:else}
				<div class="flex flex-col gap-1.5">
					{#each langs as r (r.key)}
						<div class="grid grid-cols-[5.5rem_1fr_3.2rem] items-center gap-2">
							<span class="truncate text-[11.5px] text-text-2" title={r.label}>{r.label}</span>
							<span class="h-2 overflow-hidden rounded-full bg-surface-2">
								<span class="block h-full rounded-full bg-brand" style="width:{r.pct}%"></span>
							</span>
							<span class="text-right text-[11.5px] font-bold text-text-1">%{r.pct}</span>
						</div>
					{/each}
				</div>
			{/if}
			<p class="mt-2 text-[10.5px] text-text-3">{data.languageKnown} / {data.total} yorumda dil etiketli</p>
		</div>

		<!-- Trip type -->
		<div>
			<div class="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-1">
				<Users size={14} class="text-text-3" strokeWidth={2} /> Seyahat tipi
			</div>
			{#if trips.length === 0}
				<p class="py-3 text-[12px] text-text-3">Seyahat tipi etiketli yorum yok.</p>
			{:else}
				<div class="flex flex-col gap-1.5">
					{#each trips as r (r.key)}
						<div class="grid grid-cols-[5.5rem_1fr_3.2rem] items-center gap-2">
							<span class="truncate text-[11.5px] text-text-2" title={r.label}>{r.label}</span>
							<span class="h-2 overflow-hidden rounded-full bg-surface-2">
								<span class="block h-full rounded-full bg-talkwo" style="width:{r.pct}%"></span>
							</span>
							<span class="text-right text-[11.5px] font-bold text-text-1">%{r.pct}</span>
						</div>
					{/each}
				</div>
			{/if}
			<p class="mt-2 text-[10.5px] text-text-3">{data.tripTypeKnown} / {data.total} yorumda seyahat tipi etiketli</p>
		</div>
	</div>
{/if}
