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
		/** Catalog rows (granular_key + label + category) for the grouped/searchable picker. */
		granularCatalog?: { granular_key: string; label_tr: string; category: string; category_label: string }[];
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
		granularCatalog = [],
		oncorrect
	}: Props = $props();

	// Row-local edit state: which mention is being corrected + search text + chosen key + status.
	let editingKey = $state<string | null>(null); // `${reviewId}:${targetKey}` of the open row
	let search = $state('');
	let picked = $state('');
	let saving = $state(false);
	let errorMsg = $state('');

	// Catalog filtered by the search box, then grouped by category. Empty search shows the
	// mention's OWN category first (the likely target — "havuz güvenliği" → another pool key),
	// so the picker opens on the relevant group instead of 185 flat rows.
	const filteredGroups = $derived.by(() => {
		const q = search.trim().toLocaleLowerCase('tr');
		const rows = q
			? granularCatalog.filter(
					(r) =>
						r.label_tr.toLocaleLowerCase('tr').includes(q) ||
						r.category_label.toLocaleLowerCase('tr').includes(q)
				)
			: granularCatalog;
		// Group by category_label, sort keys within a group by label.
		const byCat = new Map<string, { granular_key: string; label_tr: string }[]>();
		for (const r of rows) {
			const arr = byCat.get(r.category_label) ?? [];
			arr.push({ granular_key: r.granular_key, label_tr: r.label_tr });
			byCat.set(r.category_label, arr);
		}
		return [...byCat.entries()]
			.map(([category, keys]) => ({
				category,
				keys: keys.sort((a, b) => a.label_tr.localeCompare(b.label_tr, 'tr'))
			}))
			.sort((a, b) => a.category.localeCompare(b.category, 'tr'));
	});

	function rowId(m: MentionRow): string {
		return `${m.reviewId}:${m.targetKey ?? m.target_text ?? ''}`;
	}
	function openEdit(m: MentionRow) {
		editingKey = rowId(m);
		picked = m.granular_key ?? '';
		search = '';
		errorMsg = '';
	}
	function cancelEdit() {
		editingKey = null;
		picked = '';
		search = '';
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

					<!-- Inline correction picker (superadmin): search box + category-grouped list.
					     185 keys are unusable as a flat <select>, so we group by category and
					     filter as you type. Applies on the next scoring tick, not instantly. -->
					{#if canCorrect && editingKey === rowId(m)}
						<div class="mt-1.5 rounded-lg bg-surface-2 p-2">
							<div class="mb-1.5 flex items-center gap-2">
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									bind:value={search}
									disabled={saving}
									autofocus
									placeholder="Kategori ara… (ör. havuz, güvenlik)"
									class="min-w-0 flex-1 rounded-md border border-border bg-surface-1 px-2 py-1 text-[12px] text-text-1"
								/>
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
									class="inline-flex items-center rounded-md px-1.5 py-1 text-text-3 hover:bg-surface-1"
									title="İptal"
								>
									<X size={12} strokeWidth={2.5} />
								</button>
							</div>

							<!-- Grouped, scrollable option list. Selected key highlighted. -->
							<div class="max-h-56 overflow-y-auto rounded-md border border-border bg-surface-1">
								{#each filteredGroups as g (g.category)}
									<div class="sticky top-0 bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
										{g.category}
									</div>
									{#each g.keys as k (k.granular_key)}
										<button
											type="button"
											onclick={() => (picked = k.granular_key)}
											class="block w-full px-2.5 py-1 text-left text-[12px] transition-colors
												{picked === k.granular_key ? 'bg-brand-light font-semibold text-brand' : 'text-text-1 hover:bg-surface-2'}"
										>
											{k.label_tr}
										</button>
									{/each}
								{/each}
								{#if filteredGroups.length === 0}
									<p class="px-2.5 py-3 text-center text-[11.5px] text-text-3">Eşleşen kategori yok</p>
								{/if}
							</div>

							<p class="mt-1 text-[10.5px] {errorMsg ? 'text-danger' : 'text-text-3'}">
								{errorMsg || 'bir dahaki puanlamada yansır'}
							</p>
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
