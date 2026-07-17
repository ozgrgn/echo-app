<!--
  MentionExplorer — sentence-level ABSA mention list. Each row is one aspect
  (excerpt + polarity + subcategory), with the target_text highlighted inside the
  excerpt (green for positive feeling, red for negative). Data is REAL: it comes
  from GET /v1/mentions (flattened absa_result.aspects). A polarity filter
  (Tümü / Olumsuz / Olumlu) lets the user focus on what hurts or helps.
-->
<script lang="ts">
	import { getSubcategoryLabel } from '@talkwo/echo-core';
	import type { MentionRow } from '@talkwo/echo-ui';
	import { Pencil, Check, X } from '@lucide/svelte';

	interface Props {
		items: MentionRow[];
		/** Active polarity filter; bind to drive a refetch from the page. */
		filter?: 'all' | 'negative' | 'positive';
		onfilter?: (f: 'all' | 'negative' | 'positive') => void;
		loading?: boolean;
		/** Superadmin-only: enables the per-mention granular_key correction control. */
		canCorrect?: boolean;
		/** {granular_key → label_tr} for the correction picker (all 185 catalog keys). */
		granularLabels?: Record<string, string>;
		/** Called when a superadmin picks a new granular_key for a mislabeled mention.
		 *  Returns a promise so the row can show a pending/failed state. */
		oncorrect?: (m: MentionRow, newGranularKey: string) => Promise<void>;
	}

	let {
		items,
		filter = 'all',
		onfilter,
		loading = false,
		canCorrect = false,
		granularLabels = {},
		oncorrect
	}: Props = $props();

	// Sorted (label) list of catalog keys for the picker <select>.
	const catalogOptions = $derived(
		Object.entries(granularLabels)
			.map(([key, label]) => ({ key, label }))
			.sort((a, b) => a.label.localeCompare(b.label, 'tr'))
	);

	// Row-local edit state: which mention is being corrected + the chosen key + status.
	let editingKey = $state<string | null>(null); // `${reviewId}:${targetKey}` of the open row
	let picked = $state('');
	let saving = $state(false);
	let errorMsg = $state('');

	function rowId(m: MentionRow): string {
		return `${m.reviewId}:${m.targetKey ?? m.target_text ?? ''}`;
	}
	function openEdit(m: MentionRow) {
		editingKey = rowId(m);
		picked = m.granular_key ?? '';
		errorMsg = '';
	}
	function cancelEdit() {
		editingKey = null;
		picked = '';
		errorMsg = '';
	}
	async function saveEdit(m: MentionRow) {
		if (!oncorrect || !picked || picked === m.granular_key) return cancelEdit();
		saving = true;
		errorMsg = '';
		try {
			await oncorrect(m, picked);
			cancelEdit();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Kaydedilemedi';
		} finally {
			saving = false;
		}
	}

	// Split an excerpt around the target_text occurrence so we can wrap it in a
	// colored mark. Case-insensitive, first match only; falls back to whole-string.
	function parts(excerpt: string, target: string | null): { pre: string; hit: string; post: string } {
		if (!target) return { pre: excerpt, hit: '', post: '' };
		const i = excerpt.toLocaleLowerCase('tr').indexOf(target.toLocaleLowerCase('tr'));
		if (i < 0) return { pre: excerpt, hit: '', post: '' };
		return {
			pre: excerpt.slice(0, i),
			hit: excerpt.slice(i, i + target.length),
			post: excerpt.slice(i + target.length)
		};
	}

	const isNeg = (p: number) => p <= -0.2;
	const isPos = (p: number) => p >= 0.2;

	const TABS: { k: 'all' | 'negative' | 'positive'; l: string }[] = [
		{ k: 'all', l: 'Tümü' },
		{ k: 'negative', l: 'Olumsuz' },
		{ k: 'positive', l: 'Olumlu' }
	];
</script>

<div class="mb-3 inline-flex rounded-[11px] bg-surface-2 p-1">
	{#each TABS as t (t.k)}
		<button
			onclick={() => onfilter?.(t.k)}
			class="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{filter === t.k ? 'bg-surface-1 text-text-1 shadow-card' : 'text-text-2'}"
		>
			{t.l}
		</button>
	{/each}
</div>

{#if loading}
	<p class="px-1 py-6 text-center text-sm text-text-3">Yükleniyor…</p>
{:else if items.length === 0}
	<p class="px-1 py-6 text-center text-sm text-text-3">Bu filtreye uyan mention yok.</p>
{:else}
	<ul class="flex flex-col">
		{#each items as m, i (m.reviewId + ':' + (m.granular_key ?? m.subcategory) + ':' + i)}
			{@const neg = isNeg(m.polarity)}
			{@const pos = isPos(m.polarity)}
			{@const seg = parts(m.excerpt, m.target_text)}
			<li class="grid grid-cols-[3px_1fr_auto] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
				<!-- Polarity rail -->
				<span class="mt-1 h-full w-[3px] rounded-full {neg ? 'bg-danger' : pos ? 'bg-success' : 'bg-text-3/40'}"></span>

				<div class="min-w-0">
					<!-- The excerpt with the target_text highlighted. -->
					<p class="text-[13px] leading-snug text-text-1">
						"{seg.pre}<mark
							class="rounded px-0.5 font-semibold {neg ? 'bg-danger-light text-danger' : pos ? 'bg-success-light text-success' : 'bg-surface-2 text-text-2'}"
							>{seg.hit}</mark
						>{seg.post}"
					</p>
					<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-3">
						<!-- v2: the granular label comes from the granular catalog (always present).
						     Legacy fallback: the old 107-key subcategory label. -->
						<span class="font-semibold capitalize text-text-2"
							>{m.granular_label ?? getSubcategoryLabel(m.subcategory, 'tr')}</span
						>
						<span>·</span>
						<span class="uppercase tracking-wide">{m.platform}</span>
						{#if m.publishedDate}
							<span>·</span>
							<span>{m.publishedDate.slice(0, 10)}</span>
						{/if}
						<!-- Superadmin: correct a mislabeled mention's category. Opens an inline picker. -->
						{#if canCorrect && m.granular_key && editingKey !== rowId(m)}
							<button
								type="button"
								onclick={() => openEdit(m)}
								class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-brand hover:bg-surface-2"
								title="Kategoriyi düzelt (yanlış sınıflandırılmışsa)"
							>
								<Pencil size={11} strokeWidth={2.5} /> düzelt
							</button>
						{/if}
					</div>

					<!-- Inline correction picker (superadmin). Change effect note: applies on the
					     next scoring tick, not instantly. -->
					{#if canCorrect && editingKey === rowId(m)}
						<div class="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2">
							<select
								bind:value={picked}
								disabled={saving}
								class="max-w-[240px] rounded-md border border-border bg-surface-1 px-2 py-1 text-[12px] text-text-1"
							>
								{#each catalogOptions as o (o.key)}
									<option value={o.key}>{o.label}</option>
								{/each}
							</select>
							<button
								type="button"
								onclick={() => saveEdit(m)}
								disabled={saving || picked === m.granular_key}
								class="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50"
							>
								<Check size={12} strokeWidth={2.5} /> {saving ? '…' : 'Kaydet'}
							</button>
							<button
								type="button"
								onclick={cancelEdit}
								disabled={saving}
								class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] text-text-3 hover:bg-surface-1"
							>
								<X size={12} strokeWidth={2.5} />
							</button>
							{#if errorMsg}
								<span class="text-[11px] text-danger">{errorMsg}</span>
							{:else}
								<span class="text-[10.5px] text-text-3">bir dahaki puanlamada yansır</span>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Signed polarity score. -->
				<span class="whitespace-nowrap text-right text-[12.5px] font-extrabold {neg ? 'text-danger' : pos ? 'text-success' : 'text-text-3'}">
					{m.polarity > 0 ? '+' : ''}{m.polarity.toFixed(2)}
				</span>
			</li>
		{/each}
	</ul>
{/if}
