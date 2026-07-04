<!--
  ResponseInbox — the triage list of UNANSWERED reviews, "most burning first".
  Data is REAL: GET /v1/responses/queue returns items pre-sorted by a priority
  score (negativity × freshness × has-text, 0–100). A local toggle re-sorts by
  date for users who prefer a chronological stream. Rows expand in place to show
  the full review text + a "open on platform" link (display + triage only —
  composing replies is a later phase).
-->
<script lang="ts">
	import type { ResponseQueueItem } from '@talkwo/echo-ui';
	import { ExternalLink, Flame } from '@lucide/svelte';

	interface Props {
		items: ResponseQueueItem[];
		loading?: boolean;
	}

	let { items, loading = false }: Props = $props();

	let sortBy = $state<'priority' | 'date'>('priority');
	let expandedId = $state<string | null>(null);

	const sorted = $derived(
		sortBy === 'priority'
			? items // backend already sorts by priority
			: [...items].sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''))
	);

	// Rating tone follows the canonical 1–5 scale (rating5), not the native one.
	function ratingTone(r5: number | null): string {
		if (r5 == null) return 'bg-surface-2 text-text-2';
		if (r5 < 3) return 'bg-danger-light text-danger';
		if (r5 < 4) return 'bg-warning-light text-warning';
		return 'bg-success-light text-success';
	}
	function railTone(r5: number | null): string {
		if (r5 == null) return 'bg-text-3/40';
		if (r5 < 3) return 'bg-danger';
		if (r5 < 4) return 'bg-warning';
		return 'bg-success';
	}
	// Priority chip: ≥60 burning, ≥25 warm, else calm.
	function prioTone(p: number): string {
		if (p >= 60) return 'bg-danger-light text-danger';
		if (p >= 25) return 'bg-warning-light text-warning';
		return 'bg-surface-2 text-text-2';
	}

	function ageLabel(days: number): string {
		if (days <= 0) return 'bugün';
		if (days < 30) return `${days} gündür yanıtsız`;
		if (days < 365) return `${Math.floor(days / 30)} aydır yanıtsız`;
		return `${Math.floor(days / 365)} yıldır yanıtsız`;
	}

	const SORTS: { k: 'priority' | 'date'; l: string }[] = [
		{ k: 'priority', l: 'Öncelik' },
		{ k: 'date', l: 'En yeni' }
	];
</script>

<div class="mb-3 inline-flex rounded-[11px] bg-surface-2 p-1">
	{#each SORTS as s (s.k)}
		<button
			onclick={() => (sortBy = s.k)}
			class="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{sortBy === s.k ? 'bg-surface-1 text-text-1 shadow-card' : 'text-text-2'}"
		>
			{s.l}
		</button>
	{/each}
</div>

{#if loading}
	<p class="px-1 py-6 text-center text-sm text-text-3">Yükleniyor…</p>
{:else if items.length === 0}
	<p class="px-1 py-6 text-center text-sm text-text-3">
		Yanıt bekleyen yorum yok — tüm yorumlar yanıtlanmış. 🎉
	</p>
{:else}
	<ul class="flex flex-col">
		{#each sorted as r (r.id)}
			{@const open = expandedId === r.id}
			<li class="grid grid-cols-[3px_1fr_auto] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
				<span class="mt-1 h-full w-[3px] rounded-full {railTone(r.rating5)}"></span>

				<button class="min-w-0 text-left" onclick={() => (expandedId = open ? null : r.id)}>
					<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
						<span class="rounded px-1.5 py-0.5 text-[11px] font-extrabold {ratingTone(r.rating5)}">
							{r.rating != null ? `${r.rating}★` : '—'}
						</span>
						{#if r.title}
							<span class="truncate text-[13px] font-semibold text-text-1">{r.title}</span>
						{/if}
					</div>
					{#if r.text}
						<p class="mt-1 text-[13px] leading-snug text-text-1 {open ? '' : 'line-clamp-2'}">
							"{r.text}"
						</p>
					{:else}
						<p class="mt-1 text-[12.5px] italic text-text-3">Metinsiz yorum (yalnız puan).</p>
					{/if}
					<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-3">
						{#if r.author}<span class="font-semibold text-text-2">{r.author}</span><span>·</span>{/if}
						{#if r.publishedDate}<span>{r.publishedDate.slice(0, 10)}</span><span>·</span>{/if}
						<span class="font-semibold text-warning">{ageLabel(r.ageDays)}</span>
						{#if r.lang}<span>·</span><span class="uppercase">{r.lang}</span>{/if}
					</div>
					{#if open && r.url}
						<a
							href={r.url}
							target="_blank"
							rel="noopener noreferrer"
							onclick={(e) => e.stopPropagation()}
							class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
						>
							<ExternalLink size={13} strokeWidth={2} />
							Platformda aç ve yanıtla
						</a>
					{/if}
				</button>

				<span
					class="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-extrabold {prioTone(r.priority)}"
					title="Öncelik skoru: olumsuzluk × tazelik × metin"
				>
					{#if r.priority >= 60}<Flame size={12} strokeWidth={2.5} />{/if}
					{r.priority.toFixed(0)}
				</span>
			</li>
		{/each}
	</ul>
{/if}
