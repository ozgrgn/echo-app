<!--
  SegmentBreakdown — "who is reviewing you", by language, in two lenses side by
  side: VOLUME (how many reviews per language) and SATISFACTION (that language's
  GPI, same unit as the venue score). REAL data from GET /v1/segments. OTA data
  is sparse (many reviews carry no language), so shares are computed over the
  KNOWN subset and the unknown count is shown honestly as a footnote.

  Trip type is also returned by the endpoint but OTA rarely carries it; the trip
  column only renders when there's actually labelled data (tripTypeKnown > 0).
-->
<script lang="ts">
	import type { SegmentsResponse, SegmentBucket } from '@talkwo/echo-ui';
	import { Languages, Gauge, Users } from '@lucide/svelte';

	interface Props {
		data: SegmentsResponse | null;
		/** Venue-wide GPI, used as the reference line: a language above it is a
		 *  strength, below it an at-risk audience. Omit → neutral coloring. */
		venueGpi?: number | null;
		loading?: boolean;
	}
	let { data, venueGpi = null, loading = false }: Props = $props();

	// ISO 639-1 → Turkish label. Covered wide enough that the OTA long-tail
	// (≈18–21 languages) renders named rows instead of raw codes; anything still
	// missing falls back to its raw code and folds into "Diğer".
	const LANG_LABEL: Record<string, string> = {
		en: 'İngilizce', tr: 'Türkçe', de: 'Almanca', ru: 'Rusça',
		pl: 'Lehçe', sr: 'Sırpça', fr: 'Fransızca', nl: 'Hollandaca', ar: 'Arapça',
		it: 'İtalyanca', es: 'İspanyolca', pt: 'Portekizce', uk: 'Ukraynaca',
		ro: 'Rumence', cs: 'Çekçe', hu: 'Macarca', bg: 'Bulgarca',
		sv: 'İsveççe', da: 'Danca', fi: 'Fince', nb: 'Norveççe', no: 'Norveççe',
		el: 'Yunanca', he: 'İbranice', zh: 'Çince', ja: 'Japonca', ko: 'Korece',
		sk: 'Slovakça', hr: 'Hırvatça', sl: 'Slovence', lt: 'Litvanca',
		lv: 'Letonca', et: 'Estonca', fa: 'Farsça'
	};
	const TRIP_LABEL: Record<string, string> = {
		FAMILY: 'Aile', COUPLES: 'Çiftler', FRIENDS: 'Arkadaşlar',
		SOLO: 'Tek başına', BUSINESS: 'İş'
	};

	interface Row {
		key: string;
		label: string;
		count: number;
		pct: number;
		/** Per-language GPI; null for tripType rows and for the folded "Diğer" row
		 *  (an average of averages across different languages would mislead). */
		gpi: number | null;
	}

	// Known buckets only (drop 'unknown'), sorted desc, share over known total.
	function known(buckets: SegmentBucket[], knownTotal: number, labels: Record<string, string>): Row[] {
		const rows: Row[] = buckets
			.filter((b) => b.key !== 'unknown')
			.map((b) => ({
				key: b.key,
				label: labels[b.key] ?? b.key,
				count: b.count,
				pct: knownTotal > 0 ? Math.round((b.count / knownTotal) * 100) : 0,
				gpi: b.gpi ?? null
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
			pct: knownTotal > 0 ? Math.round((tailCount / knownTotal) * 100) : 0,
			gpi: null // folded languages: no single meaningful GPI
		});
		return head;
	}

	const langs = $derived(data ? known(data.byLanguage, data.languageKnown, LANG_LABEL) : []);
	const trips = $derived(data ? known(data.byTripType, data.tripTypeKnown, TRIP_LABEL) : []);
	// Only show the trip-type lens when the data actually has labels (OTA usually
	// doesn't) — otherwise the language GPI lens takes its place.
	const hasTrip = $derived((data?.tripTypeKnown ?? 0) > 0);

	// GPI cell coloring vs the venue reference (the overall GPI, base = venueGpi):
	// above the average → strength (green), below → at-risk (warning), exactly equal
	// → neutral. No deadband (owner decision): a language above the venue average reads
	// green even by a point — the reference IS the average, so "above it" is the signal.
	// Rounded to whole points (the cell shows 0-decimal) so color matches the number.
	function gpiTone(gpi: number | null): string {
		if (gpi == null || venueGpi == null) return 'text-text-1';
		if (Math.round(gpi) > Math.round(venueGpi)) return 'text-success';
		if (Math.round(gpi) < Math.round(venueGpi)) return 'text-warning';
		return 'text-text-1';
	}
</script>

{#if loading}
	<p class="px-1 py-6 text-center text-sm text-text-3">Yükleniyor…</p>
{:else if !data}
	<p class="px-1 py-6 text-center text-sm text-text-3">Segment verisi yok.</p>
{:else if langs.length === 0}
	<p class="px-1 py-6 text-center text-sm text-text-3">Dil etiketli yorum yok.</p>
{:else}
	<!-- Two lenses on the SAME language rows, aligned: volume (left) + GPI (right). -->
	<div class="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
		<!-- Language volume -->
		<div>
			<div class="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-1">
				<Languages size={14} class="text-text-3" strokeWidth={2} /> Dil · hacim
			</div>
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
			<p class="mt-2 text-[10.5px] text-text-3">{data.languageKnown} / {data.total} yorumda dil etiketli</p>
		</div>

		<!-- Language satisfaction (GPI) — same rows/order as the volume column. -->
		<div>
			<div class="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-1">
				<Gauge size={14} class="text-text-3" strokeWidth={2} /> Dil · memnuniyet (GPI)
			</div>
			<div class="flex flex-col gap-1.5">
				{#each langs as r (r.key)}
					<div class="grid grid-cols-[5.5rem_1fr_3.2rem] items-center gap-2">
						<span class="truncate text-[11.5px] text-text-2" title={r.label}>{r.label}</span>
						{#if r.gpi != null}
							<span class="h-2 overflow-hidden rounded-full bg-surface-2">
								<span class="block h-full rounded-full bg-talkwo" style="width:{Math.max(0, Math.min(100, r.gpi))}%"></span>
							</span>
							<span class="text-right text-[11.5px] font-bold {gpiTone(r.gpi)}">{r.gpi.toFixed(0)}</span>
						{:else}
							<span class="h-2 rounded-full bg-surface-2 opacity-40"></span>
							<span class="text-right text-[11.5px] text-text-3" title="Güvenilir GPI için yeterli analiz yok">—</span>
						{/if}
					</div>
				{/each}
			</div>
			<p class="mt-2 text-[10.5px] text-text-3">
				{#if venueGpi != null}genel GPI {venueGpi.toFixed(0)} · {/if}dil bazlı memnuniyet
			</p>
		</div>

		<!-- Trip type — only when the data actually carries labels (OTA rarely does). -->
		{#if hasTrip}
			<div class="lg:col-span-2 border-t border-border pt-4">
				<div class="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-1">
					<Users size={14} class="text-text-3" strokeWidth={2} /> Seyahat tipi
				</div>
				<div class="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
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
				<p class="mt-2 text-[10.5px] text-text-3">{data.tripTypeKnown} / {data.total} yorumda seyahat tipi etiketli</p>
			</div>
		{/if}
	</div>
{/if}
