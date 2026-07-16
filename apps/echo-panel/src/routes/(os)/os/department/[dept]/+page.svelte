<!--
  Department detail lens. Data is REAL: GET /v1/departments/:slug/:deptKey rolls
  the venue's category scores up to the responsible department (taxonomy
  primaryOwner). Score, category breakdown ("alt kırılım"), complaints, and the
  score trend are real; sentence-level mentions come from /v1/mentions filtered to
  this department's categories.

  The goal affordances are GONE, not empty. There is no Goal model yet, so the "Hedef —"
  tile and the "Aktif hedefler → yakında gelecek" card were permanently blank: they
  advertised a feature instead of showing one, which reads as an unfinished product.
  Re-add them when the Goal model ships (ECHO_OS_GAP_PLAN Faz 5.3), not before.

  Still placeholder-backed: Yanıt Yönetimi market rate → [MOCK→radar].
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { windowParam, parseOsWindow } from '$lib/config/window';
	import { osState } from '$lib/stores/osState.svelte';

	import SectionCard from '$lib/components/SectionCard.svelte';
	import GoalProgress from '$lib/components/GoalProgress.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import MentionList from '$lib/components/MentionList.svelte';
	import MentionExplorer from '$lib/components/MentionExplorer.svelte';
	import CategoryHistoryModal from '$lib/components/CategoryHistoryModal.svelte';
	import OpportunityList from '$lib/components/OpportunityList.svelte';
	import ResponseAnalytics from '$lib/components/ResponseAnalytics.svelte';
	import {
		type DepartmentDetail,
		type DepartmentScore,
		type MentionRow,
		type ResponseStats
	} from '@talkwo/echo-ui';
	import { CATEGORIES, getSubcategoryLabel, type CategoryKey } from '@talkwo/echo-core';
	import {
		TrendingDown, TrendingUp, ListTree, CircleAlert, Rocket,
		ArrowLeft, MessageCircleReply, MessageSquare, History, X
	} from '@lucide/svelte';

	let { data } = $props();
	const deptKey = $derived(data.deptKey as string);

	// Stable accent per ops-engine department key (cosmetic only — not data).
	// Falls back to a neutral brand tint for unknown keys.
	const DEPT_COLOR: Record<string, string> = {
		hk: '#7c5cff',
		fnb: '#f59e0b',
		fo: '#0ea5e9',
		anm: '#ec4899',
		mnt: '#10b981',
		spa: '#8b5cf6',
		pnb: '#06b6d4',
		gr: '#6366f1',
		sec: '#ef4444',
		kitchen: '#f97316',
		con: '#14b8a6',
		it: '#64748b'
	};
	const color = $derived(DEPT_COLOR[deptKey] ?? 'var(--color-brand)');

	// ── Real detail + sibling list (for the in-lens switcher) ───────────────────
	let detail = $state<DepartmentDetail | null>(null);
	let siblings = $state<DepartmentScore[]>([]);
	let loading = $state(false);
	let errored = $state(false);

	async function loadDetail(window: string | undefined) {
		// Always live: the mock short-circuit that blanked this lens in demo mode is gone
		// (demo tenants now hit the same endpoint with a real session).
		loading = true;
		errored = false;
		try {
			const wq = window ? `&window=${window}` : '';
			const [dr, lr] = await Promise.all([
				fetch(`/api/os/data?resource=departmentDetail&deptKey=${encodeURIComponent(deptKey)}${wq}`),
				fetch(`/api/os/data?resource=departments${wq}`)
			]);
			if (!dr.ok) throw new Error('departmentDetail failed');
			detail = await dr.json();
			siblings = lr.ok ? (await lr.json()).departments : [];
		} catch {
			errored = true;
			detail = null;
		} finally {
			loading = false;
		}
	}
	// Re-fetch on deptKey OR global window change (reading both inside the effect
	// subscribes it to route param + rail selector's ?window=).
	$effect(() => {
		void deptKey;
		loadDetail(windowParam(parseOsWindow(page.url.searchParams.get('window'))));
	});

	const score = $derived(detail?.score ?? 0);
	const scoreColor = $derived(score >= 65 ? 'text-success' : score >= 55 ? 'text-warning' : 'text-danger');

	// Real trend series → chart. Filter out null points (periods with no mentions)
	// in ONE pass so scores and their period labels stay aligned; need ≥2 real
	// points to draw a line, else show the "yeterli geçmiş yok" note.
	const trendPts = $derived(
		(detail?.trend_series ?? []).filter((p): p is { period: string; score: number } => p.score != null)
	);
	const trendActual = $derived(trendPts.map((p) => p.score));
	const trendPeriods = $derived(trendPts.map((p) => p.period));
	// Snapshot periods are monthly 'YYYY-MM'; a longer key means a daily series.
	const trendDaily = $derived((trendPeriods[0]?.length ?? 7) > 7);
	const trendHasHistory = $derived(trendActual.length > 1);
	const trendYmin = $derived(trendActual.length ? Math.floor(Math.min(...trendActual) - 6) : 0);
	const trendYmax = $derived(trendActual.length ? Math.ceil(Math.max(...trendActual) + 6) : 100);
	const trendDown = $derived((detail?.trend ?? 0) < 0);
	const trendLabel = $derived(
		(detail?.trend ?? 0) < 0 ? 'Düşüşte' : (detail?.trend ?? 0) > 0 ? 'Yükselişte' : 'Sabit'
	);

	// Category breakdown ("alt kırılım") → MentionList-free simple rows.
	// v2 granular fields (granular_key/granular_label/score) aren't in echo-ui's
	// DepartmentCategoryBreakdown type yet; the backend sends them. Widen locally
	// so we can prefer the granular fields and fall back to the v1 aliases.
	type V2Breakdown = NonNullable<typeof detail>['breakdown'][number] & {
		granular_key?: string;
		granular_label?: string;
		score?: number | null;
		/** Legacy alias (== granular_key on post-Step-4 snapshots) — key fallback. */
		subcategory?: string;
	};
	const breakdown = $derived((detail?.breakdown ?? []) as V2Breakdown[]);

	// Complaints → MentionList shape (category/subcategory display labels).
	// Complaints are keyed by GRANULAR key (v0.3 catalog) — the only granularity that
	// attributes a complaint to one department. Their Turkish label ships from the
	// backend as `granular_label`; getSubcategoryLabel() must NOT be used here, as it
	// only knows the 107-key parent taxonomy and would echo the raw key back
	// ("Room_general_assignment_expectation"). echo-ui's DepartmentDetail type predates
	// this, so widen locally.
	type V2Issue = { category: string; subcategory: string; sampleExcerpt: string; count: number } & {
		granular_label?: string;
	};
	const issues = $derived(
		((detail?.topIssues ?? []) as V2Issue[]).map((it) => ({
			// Display label, not the raw enum ("FOOD") — MentionList's pill expects a label.
			// `category` is typed as string by echo-ui but is always a taxonomy key.
			category: CATEGORIES[it.category as CategoryKey]?.label ?? it.category,
			subcategory: it.granular_label ?? getSubcategoryLabel(it.subcategory, 'tr'),
			excerpt: it.sampleExcerpt,
			count: it.count
		}))
	);

	// Opportunities: lowest-score × highest-mention among this dept's categories.
	const opportunities = $derived(
		[...breakdown]
			.map((b) => ({ b, s: b.score ?? null }))
			.filter((x) => x.b.mentionCount > 0 && x.s != null)
			.map((x) => ({ b: x.b, s: x.s as number, leverage: (85 - (x.s as number)) * Math.log10(x.b.mentionCount + 1) }))
			.sort((a, b) => b.leverage - a.leverage)
			.slice(0, 3)
			.map((x, i) => ({
				rank: i + 1,
				label: x.b.granular_label ?? x.b.label,
				mentions: x.b.mentionCount,
				score: x.s,
				lift: `+${(x.leverage / 10).toFixed(1)}`
			}))
	);

	// ── Sentence-level mentions for this department's categories (REAL) ─────────
	let mentions = $state<MentionRow[]>([]);
	let mentionFilter = $state<'all' | 'negative' | 'positive'>('all');
	let mentionsLoading = $state(false);
	// Optional single-category narrowing: set by clicking a breakdown row's mention
	// count (accuracy spot-checks — "bu 18 mention hangi cümleler?"). Null = whole dept.
	let mentionScope = $state<{ key: string; label: string } | null>(null);

	async function loadMentions() {
		// Scope by the department's GRANULAR KEYS, not its categories. A category no
		// longer belongs to one department (ROOM feeds hk + fo + mnt + tesis), so a
		// category filter pulled in other departments' mentions ("Manzara & Balkon"
		// under Kat Hizmetleri). breakdown[] is exactly this department's granular set.
		// An active mentionScope narrows the whole-dept set to ONE granular key.
		const gks = mentionScope
			? [mentionScope.key]
			: breakdown.map((b) => b.granular_key).filter((k): k is string => !!k);
		const cats = detail?.categories ?? [];
		// Nothing to scope by → nothing to fetch (the mock short-circuit is gone).
		if (gks.length === 0 && cats.length === 0) {
			mentions = [];
			return;
		}
		mentionsLoading = true;
		try {
			// v2: one call, filtered to this department's granular keys. Legacy fallback
			// (pre-v2 snapshot with no granular_key): the old per-category fan-out.
			const results = gks.length
				? await (async () => {
						const params = new URLSearchParams({
							resource: 'mentions',
							granularKey: gks.join(','),
							limit: '60'
						});
						if (mentionFilter !== 'all') params.set('polarity', mentionFilter);
						const r = await fetch(`/api/os/data?${params}`);
						return [r.ok ? await r.json() : { items: [] }];
					})()
				: await Promise.all(
						cats.map(async (category) => {
							const params = new URLSearchParams({ resource: 'mentions', category, limit: '40' });
							if (mentionFilter !== 'all') params.set('polarity', mentionFilter);
							const r = await fetch(`/api/os/data?${params}`);
							return r.ok ? await r.json() : { items: [] };
						})
					);
			mentions = results
				.flatMap((r) => r.items)
				.sort((a, b) => Math.abs(b.polarity) - Math.abs(a.polarity))
				.slice(0, 60);
		} catch {
			mentions = [];
		} finally {
			mentionsLoading = false;
		}
	}
	$effect(() => {
		void deptKey;
		void mentionFilter;
		void mentionScope;
		if (detail) loadMentions();
	});
	function setMentionFilter(f: 'all' | 'negative' | 'positive') {
		mentionFilter = f;
	}
	// Another department's keys make the scope stale — drop it on switch.
	$effect(() => {
		void deptKey;
		mentionScope = null;
	});

	/** Row's mention count clicked → narrow the Mentions section to that key and
	 *  bring it into view (clicking the active scope again clears it). */
	function toggleMentionScope(b: V2Breakdown) {
		const key = b.granular_key ?? b.subcategory;
		if (!key) return;
		mentionScope = mentionScope?.key === key ? null : { key, label: b.granular_label ?? b.label };
		if (mentionScope) {
			document.getElementById('dept-mentions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// ── Category history modal (per-granular-key trend, own window tabs) ────────
	let historyOpen = $state(false);
	let historyKey = $state<string | null>(null);
	let historyLabel = $state('');
	function openHistory(b: V2Breakdown) {
		const key = b.granular_key ?? b.subcategory;
		if (!key) return;
		historyKey = key;
		historyLabel = b.granular_label ?? b.label;
		historyOpen = true;
	}

	// ── Response analytics (venue-wide; per-department split is not modeled yet) ──
	// REAL stats only. Unreachable → null → the card shows an honest empty state
	// instead of the old fabricated responseSliceFor() slice.
	let respStats = $state<ResponseStats | null>(null);
	async function loadResp() {
		try {
			// Same window as the page's other numbers (backend defaults to 24mo).
			const w = parseOsWindow(page.url.searchParams.get('window'));
			const r = await fetch(`/api/os/data?resource=responseStats&window=${encodeURIComponent(w)}`);
			respStats = r.ok ? await r.json() : null;
		} catch {
			respStats = null;
		}
	}
	$effect(() => {
		loadResp();
	});
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
					competitorAvgRate: null
				}
			: null
	);

	// Back to the Departments list lens — replaces the global LensTabs row.
	function backToList() {
		osState.setLens({ kind: 'departments' });
		goto('/os/departments');
	}
	function switchTo(key: string) {
		if (key === deptKey) return;
		osState.setLens({ kind: 'department', department: key });
		goto(`/os/department/${key}`);
	}
</script>

<!-- Back to Departments list + department switcher on one row. -->
<div class="mb-3.5 flex flex-wrap items-center gap-2">
	<button
		onclick={backToList}
		class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
	>
		<ArrowLeft size={15} strokeWidth={2} />
		Geri
	</button>
	<span class="mx-0.5 h-5 w-px bg-border"></span>
	{#each siblings as s (s.key)}
		{@const active = s.key === deptKey}
		{@const c = DEPT_COLOR[s.key] ?? 'var(--color-text-3)'}
		<button
			onclick={() => switchTo(s.key)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{active ? 'border-transparent text-white' : 'border-border bg-surface-1 text-text-2 hover:bg-surface-2'}"
			style={active ? `background:${c}` : ''}
		>
			<span class="h-2 w-2 rounded-full" style="background:{active ? 'rgba(255,255,255,0.8)' : c}"></span>
			{s.label}
		</button>
	{/each}
</div>

{#if loading}
	<p class="py-16 text-center text-sm text-text-3">Departman yükleniyor…</p>
{:else if errored || !detail}
	<p class="py-16 text-center text-sm text-text-3">Departman verisi alınamadı. Sayfayı yenileyin.</p>
{:else}
	<!-- ── Hero band (target/progress = 0 until Goal model lands) ──────────────── -->
	<div class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border p-5" style="background:{color}12;border-color:{color}40">
		<span class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] text-white" style="background:{color}">
			<ListTree size={24} strokeWidth={2} />
		</span>
		<div class="min-w-0">
			<div class="text-base font-extrabold text-text-1">{detail.label}</div>
			<div class="mt-0.5 text-xs text-text-3">
				{detail.categories.length} kategoriden sorumlu · {detail.mentionCount} mention
			</div>
		</div>
		<div class="ml-auto flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Departman skoru</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight {scoreColor}">{score.toFixed(0)}</span>
		</div>
	</div>

	<!-- Score trend. The goal affordances that used to sit here — a "Hedef —" tile in the
	     hero and an "Aktif hedefler" card reading "yakında gelecek" — are gone. There is no
	     Goal model yet, so both were permanently empty: they advertised a feature rather
	     than showing one, which reads as an unfinished product. The trend now takes the
	     full width. Bring them back with the Goal model, not before. -->
	<div class="mb-3.5">
		<SectionCard title="Departman skoru trendi" icon={trendDown ? TrendingDown : TrendingUp}>
			{#snippet action()}
				<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold {trendDown ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}">
					{trendLabel}
				</span>
			{/snippet}
			{#if trendHasHistory}
				<TrendChart actual={trendActual} periods={trendPeriods} daily={trendDaily} valueLabel="Skor" ymin={trendYmin} ymax={trendYmax} color={color} height={210} />
			{:else}
				<p class="py-14 text-center text-[13px] text-text-3">
					Bu departman için yeterli geçmiş yok — güncel skor <b class="text-text-1">{score.toFixed(1)}</b>.<br />
					Trend, skorlama koştukça birikecek.
				</p>
			{/if}
		</SectionCard>
	</div>

	<!-- Full category breakdown (alt kırılım) — REAL -->
	<div class="mb-3.5">
		<SectionCard title="{detail.label} kategorileri · tümü" icon={ListTree} hint="{breakdown.length} kategori · skor · mention · trend">
			{#if breakdown.length === 0}
				<p class="py-6 text-center text-[13px] text-text-3">Bu departman için kategori skoru yok.</p>
			{:else}
				<div class="flex flex-col">
					{#each breakdown as b (b.granular_key ?? b.category)}
						{@const bScore = b.score ?? null}
						{@const tone = bScore == null ? 'text-text-3' : bScore >= 65 ? 'text-success' : bScore >= 55 ? 'text-warning' : 'text-danger'}
						{@const rowKey = b.granular_key ?? b.subcategory}
						{@const scoped = mentionScope?.key === rowKey}
						<div class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
							<div class="flex min-w-0 items-center">
								<!-- Category name opens the history modal (same as the row's chart icon —
								     the icon exists because plain text doesn't read as clickable). -->
								<button
									onclick={() => openHistory(b)}
									class="min-w-0 truncate text-left text-[13px] font-semibold text-text-1 transition-colors hover:text-brand hover:underline"
									title="Tarihsel grafiği aç"
								>
									{b.granular_label ?? b.label}
								</button>
								<!-- Mention count narrows the Mentions section to this key (accuracy checks). -->
								<button
									onclick={() => toggleMentionScope(b)}
									class="ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] transition-colors
										{scoped ? 'bg-brand-light font-semibold text-brand' : 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
									title={scoped ? 'Mention filtresini kaldır' : 'Bu kategorinin mention’larını göster'}
								>
									{b.mentionCount} mention
								</button>
							</div>
							<div class="flex items-center gap-2">
								{#if b.trend != null && b.trend !== 0}
									<span class="text-[11px] font-bold {b.trend > 0 ? 'text-success' : 'text-danger'}">
										{b.trend > 0 ? '+' : ''}{b.trend.toFixed(1)}
									</span>
								{/if}
								<span class="text-[15px] font-extrabold {tone}">{bScore != null ? bScore.toFixed(0) : '—'}</span>
								<button
									onclick={() => openHistory(b)}
									class="rounded-md p-1 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
									title="Tarihsel grafik"
									aria-label="{b.granular_label ?? b.label} tarihsel grafiği"
								>
									<History size={14} strokeWidth={2} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</SectionCard>
	</div>

	<!-- Complaints + leverage — REAL -->
	<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
		<SectionCard title="Skoru düşüren şikâyetler" icon={CircleAlert} hint="en sık">
			<!-- detail.reviewCount IS the department's mentionCount (departments.ts) —
			     label the share denominator honestly as mentions, not reviews. -->
			<MentionList items={issues} tone="issue" total={detail.reviewCount} unit="mention" emptyText="Şikâyet kaydı yok." />
		</SectionCard>
		<SectionCard title="Hedefe en hızlı yol" icon={Rocket} hint="kaldıraç sıralı">
			<OpportunityList items={opportunities} />
		</SectionCard>
	</div>

	<!-- Sentence-level mentions across this department's categories — REAL.
	     The id is the scroll anchor for the breakdown rows' mention-count buttons. -->
	<div id="dept-mentions" class="scroll-mt-4">
		<SectionCard title="Mentions · {detail.label}" icon={MessageSquare} class="mb-3.5">
			{#snippet action()}
				{#if mentionScope}
					<button
						onclick={() => (mentionScope = null)}
						class="inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand transition-colors hover:opacity-80"
						title="Kategori filtresini kaldır"
					>
						{mentionScope.label}
						<X size={12} strokeWidth={2.5} />
					</button>
				{:else}
					<span class="text-[11.5px] text-text-3">Cümle düzeyi · ABSA</span>
				{/if}
			{/snippet}
			<MentionExplorer
				items={mentions}
				filter={mentionFilter}
				onfilter={setMentionFilter}
				loading={mentionsLoading}
			/>
		</SectionCard>
	</div>

	<!-- Response analytics — real venue-wide rates only; unreachable → empty state. -->
	<SectionCard title="Yanıt Yönetimi · {detail.label}" icon={MessageCircleReply} hint="duygu">
		{#if respAnalytics}
			<ResponseAnalytics
				overallRate={respAnalytics.overallRate}
				medianHours={respAnalytics.medianHours}
				bySentiment={respAnalytics.bySentiment}
				competitorAvgRate={respAnalytics.competitorAvgRate}
				overallLabel="{detail.label} yanıt oranı"
			/>
		{:else}
			<p class="py-6 text-center text-[12px] text-text-3">
				Yanıt istatistikleri şu anda yüklenemedi — sayfayı yenileyin.
			</p>
		{/if}
	</SectionCard>

	<!-- Per-category history modal. It OPENS on the page's window so its score and mention
	     count match the row that was clicked (they used to disagree — the row showed 24mo,
	     the dialog always opened on 'max'). Its tabs then let you widen the horizon. -->
	<CategoryHistoryModal
		open={historyOpen}
		onOpenChange={(o) => (historyOpen = o)}
		{deptKey}
		granularKey={historyKey}
		label={historyLabel}
		{color}
		pageWindow={parseOsWindow(page.url.searchParams.get('window'))}
	/>
{/if}
