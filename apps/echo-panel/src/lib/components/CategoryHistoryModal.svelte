<!--
  CategoryHistoryModal — historical score series for ONE granular key of a
  department, in a dialog. Opened from the department page's category rows.

  IT OPENS ON THE PAGE'S WINDOW. It used to always open on 'max', on the theory that
  "history is the point" — but the row you clicked showed a 24-month score and mention
  count, and the dialog that opened showed a 3-year one. Same category, two different
  numbers, seconds apart (33 vs 27; 18 mentions vs 1442). Whatever horizon you are
  reading the department at, the drill-down starts there; the tabs then let you widen
  it, and switching them refetches only this series, never the page.

  Only monthly-series windows are offered: 3mo/6mo history lives in the DAILY store,
  which this per-key endpoint doesn't read — so a page sitting on 6mo falls back to the
  nearest monthly window it can actually plot.
-->
<script lang="ts">
	import { Dialog } from 'bits-ui';
	import TrendChart from './TrendChart.svelte';
	import { zoneClass } from '@talkwo/echo-core';
	import { OS_WINDOW_TABS, type OsWindow } from '$lib/config/window';
	import { History } from '@lucide/svelte';

	interface TrendPoint {
		period: string;
		score: number | null;
		mentions: number;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		deptKey: string;
		/** Granular routing key of the category being inspected (null = closed). */
		granularKey: string | null;
		/** Display label for the dialog title. */
		label: string;
		/** Department accent color (same as the page's DEPT_COLOR). */
		color?: string;
		/** The window the PAGE is on. The modal opens here so its numbers match the row
		 *  that was clicked; the user can widen it from the tabs. */
		pageWindow?: OsWindow;
	}

	let {
		open,
		onOpenChange,
		deptKey,
		granularKey,
		label,
		color = 'var(--color-brand)',
		pageWindow = 'max'
	}: Props = $props();

	// Monthly-series windows only (see header note).
	const WINDOWS = OS_WINDOW_TABS.filter((t) => ['max', '24mo', '12mo'].includes(t.key));
	const MONTHLY: OsWindow[] = ['max', '24mo', '12mo'];

	/** The page may sit on a window this endpoint cannot plot (3mo/6mo are daily-store
	 *  only). Fall back to the widest monthly window rather than fetching a series that
	 *  comes back empty. */
	const initialWindow = $derived(MONTHLY.includes(pageWindow) ? pageWindow : '24mo');

	let histWindow = $state<OsWindow>('max');
	// Re-seed each time the dialog opens for a new key, so it always starts on the page's
	// horizon — but leave the user's tab choice alone while it stays open.
	$effect(() => {
		if (open && granularKey) histWindow = initialWindow;
	});

	let points = $state<TrendPoint[]>([]);
	let loading = $state(false);
	let errored = $state(false);

	async function load(key: string, w: OsWindow) {
		loading = true;
		errored = false;
		try {
			const params = new URLSearchParams({
				resource: 'departmentKeyTrend',
				deptKey,
				granularKey: key,
				window: w
			});
			const r = await fetch(`/api/os/data?${params}`);
			if (!r.ok) throw new Error('departmentKeyTrend failed');
			points = (await r.json()).points ?? [];
		} catch {
			errored = true;
			points = [];
		} finally {
			loading = false;
		}
	}
	// Refetch whenever the dialog is open for a key, or the modal window changes.
	$effect(() => {
		if (open && granularKey) load(granularKey, histWindow);
	});

	// Chart inputs: drop null-score periods but keep period alignment (one pass).
	const scored = $derived(points.filter((p): p is TrendPoint & { score: number } => p.score != null));
	const actual = $derived(scored.map((p) => p.score));
	const periods = $derived(scored.map((p) => p.period));
	const notes = $derived(scored.map((p) => `${p.mentions} mention`));
	const ymin = $derived(actual.length ? Math.floor(Math.min(...actual) - 6) : 0);
	const ymax = $derived(actual.length ? Math.ceil(Math.max(...actual) + 6) : 100);
	const totalMentions = $derived(points.reduce((n, p) => n + p.mentions, 0));
	const last = $derived(scored.length ? scored[scored.length - 1] : null);
	const lastTone = $derived(zoneClass(last?.score));
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-40 bg-text-1/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,680px)] max-h-[90vh] overflow-y-auto bg-surface-1 rounded-xl shadow-xl border border-border p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
		>
			<!-- Header: title + current score + close -->
			<div class="mb-4 flex items-start justify-between gap-4">
				<div class="min-w-0">
					<Dialog.Title class="flex items-center gap-2 text-lg font-bold leading-tight text-text-1">
						<History size={18} class="shrink-0 text-text-3" strokeWidth={2} />
						{label}
					</Dialog.Title>
					<p class="mt-1 text-xs text-text-3">
						Tarihsel kategori skoru · {totalMentions} mention
					</p>
				</div>
				<div class="flex items-center gap-3">
					{#if last}
						<span class="text-[28px] font-extrabold leading-none tracking-tight {lastTone}">{last.score.toFixed(0)}</span>
					{/if}
					<Dialog.Close
						class="shrink-0 rounded-md p-1.5 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
						aria-label="Kapat"
					>
						✕
					</Dialog.Close>
				</div>
			</div>

			<!-- Modal-local window tabs -->
			<div class="mb-4 inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
				{#each WINDOWS as w (w.key)}
					<button
						onclick={() => (histWindow = w.key)}
						class="rounded-md px-3 py-1 text-[12px] font-semibold transition-colors
							{histWindow === w.key ? 'bg-surface-1 text-text-1 shadow-sm' : 'text-text-3 hover:text-text-2'}"
					>
						{w.label}
					</button>
				{/each}
			</div>

			{#if loading}
				<p class="py-16 text-center text-[13px] text-text-3">Geçmiş yükleniyor…</p>
			{:else if errored}
				<p class="py-16 text-center text-[13px] text-text-3">Kategori geçmişi alınamadı.</p>
			{:else if actual.length > 1}
				<TrendChart {actual} {periods} pointNotes={notes} valueLabel="Skor" {ymin} {ymax} {color} height={230} />
			{:else}
				<p class="py-14 text-center text-[13px] text-text-3">
					Bu kategori için bu pencerede yeterli geçmiş yok.<br />
					Skorlama koştukça seri birikecek.
				</p>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
