<!--
  Department detail lens. Data is REAL: GET /v1/departments/:slug/:deptKey rolls
  the venue's category scores up to the responsible department (taxonomy
  primaryOwner). Score, category breakdown ("alt kırılım"), complaints, and the
  score trend are real; sentence-level mentions come from /v1/mentions filtered to
  this department's categories.

  Fields the backend does NOT serve yet are kept in the layout but rendered empty
  / zero (they fill in as more data lands — see ECHO_OS_GAP_PLAN Faz 5.3):
    · Hedef (target) + ilerleme  → 0 (no Goal model yet)
    · Aktif hedefler (goals)      → empty state
    · Yanıt Yönetimi market rate  → [MOCK→radar]
  Nothing is removed from the page; missing numbers show as 0 / "—".
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { osState } from '$lib/stores/osState.svelte';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';

	import SectionCard from '$lib/components/SectionCard.svelte';
	import GoalProgress from '$lib/components/GoalProgress.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import MentionList from '$lib/components/MentionList.svelte';
	import MentionExplorer from '$lib/components/MentionExplorer.svelte';
	import OpportunityList from '$lib/components/OpportunityList.svelte';
	import ResponseAnalytics from '$lib/components/ResponseAnalytics.svelte';
	import { responseSliceFor } from '$lib/mock/os';
	import {
		type DepartmentDetail,
		type DepartmentScore,
		type MentionRow,
		type ResponseStats
	} from '@talkwo/echo-ui';
	import { getSubcategoryLabel } from '@talkwo/echo-core';
	import {
		Target, TrendingDown, TrendingUp, ListTree, CircleAlert, Rocket,
		ArrowLeft, MessageCircleReply, MessageSquare
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

	async function loadDetail() {
		if (osDataSource.isMock) {
			detail = null;
			return;
		}
		loading = true;
		errored = false;
		try {
			const [dr, lr] = await Promise.all([
				fetch(`/api/os/data?resource=departmentDetail&deptKey=${encodeURIComponent(deptKey)}`),
				fetch('/api/os/data?resource=departments')
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
	$effect(() => {
		void deptKey;
		loadDetail();
	});

	const score = $derived(detail?.score ?? 0);
	const scoreColor = $derived(score >= 70 ? 'text-success' : score >= 55 ? 'text-warning' : 'text-danger');

	// Real trend series → chart. Filter out null points (periods with no mentions);
	// need ≥2 real points to draw a line, else show the "yeterli geçmiş yok" note.
	const trendActual = $derived((detail?.trend_series ?? []).map((p) => p.score).filter((s): s is number => s != null));
	const trendHasHistory = $derived(trendActual.length > 1);
	const trendYmin = $derived(trendActual.length ? Math.floor(Math.min(...trendActual) - 6) : 0);
	const trendYmax = $derived(trendActual.length ? Math.ceil(Math.max(...trendActual) + 6) : 100);
	const trendDown = $derived((detail?.trend ?? 0) < 0);
	const trendLabel = $derived(
		(detail?.trend ?? 0) < 0 ? 'Düşüşte' : (detail?.trend ?? 0) > 0 ? 'Yükselişte' : 'Sabit'
	);

	// Category breakdown ("alt kırılım") → MentionList-free simple rows.
	const breakdown = $derived(detail?.breakdown ?? []);

	// Complaints → MentionList shape (category/subcategory display labels).
	const issues = $derived(
		(detail?.topIssues ?? []).map((it) => ({
			category: it.category,
			subcategory: getSubcategoryLabel(it.subcategory, 'tr'),
			excerpt: it.sampleExcerpt,
			count: it.count
		}))
	);

	// Opportunities: lowest-score × highest-mention among this dept's categories.
	const opportunities = $derived(
		[...breakdown]
			.filter((b) => b.mentionCount > 0)
			.map((b) => ({ b, leverage: (85 - b.headlineScore) * Math.log10(b.mentionCount + 1) }))
			.sort((a, b) => b.leverage - a.leverage)
			.slice(0, 3)
			.map((x, i) => ({
				rank: i + 1,
				label: x.b.label,
				mentions: x.b.mentionCount,
				score: x.b.headlineScore,
				lift: `+${(x.leverage / 10).toFixed(1)}`
			}))
	);

	// ── Sentence-level mentions for this department's categories (REAL) ─────────
	let mentions = $state<MentionRow[]>([]);
	let mentionFilter = $state<'all' | 'negative' | 'positive'>('all');
	let mentionsLoading = $state(false);

	async function loadMentions() {
		const cats = detail?.categories ?? [];
		if (osDataSource.isMock || cats.length === 0) {
			mentions = [];
			return;
		}
		mentionsLoading = true;
		try {
			// One fetch per category (mentions API filters by a single category),
			// then merge. Kept small (limit 40 each) — this dept has ≤5 categories.
			const results = await Promise.all(
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
		if (detail) loadMentions();
	});
	function setMentionFilter(f: 'all' | 'negative' | 'positive') {
		mentionFilter = f;
	}

	// ── Response analytics scoped to this department — market rate [MOCK→radar] ──
	let respStats = $state<ResponseStats | null>(null);
	const respSlice = $derived(responseSliceFor(deptKey, 0.6));
	async function loadResp() {
		if (osDataSource.isMock) {
			respStats = null;
			return;
		}
		try {
			// Venue-wide response stats (per-department response split is not modeled
			// yet — market comparison stays [MOCK→radar]).
			const r = await fetch('/api/os/data?resource=responseStats');
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
					competitorAvgRate: respSlice.competitorAvgRate
				}
			: {
					overallRate: respSlice.overallRate,
					medianHours: null,
					bySentiment: respSlice.bySentiment,
					competitorAvgRate: respSlice.competitorAvgRate
				}
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
		<div class="ml-auto flex items-end gap-3">
			<div class="flex flex-col items-end">
				<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Departman skoru</span>
				<span class="text-[42px] font-extrabold leading-none tracking-tight {scoreColor}">{score.toFixed(0)}</span>
			</div>
			<div class="flex min-w-[84px] flex-col gap-0.5 rounded-xl border bg-surface-1 px-3 py-2.5" style="border-color:{color}33">
				<span class="text-[10px] font-bold uppercase tracking-wide text-text-3">Hedef</span>
				<span class="text-[22px] font-extrabold leading-tight text-text-3">—</span>
				<span class="text-[10px] text-text-3">hedef tanımlı değil</span>
			</div>
		</div>
	</div>

	<!-- Score trend (REAL) + active goals (empty until Goal model) -->
	<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
		<SectionCard title="Departman skoru trendi" icon={trendDown ? TrendingDown : TrendingUp}>
			{#snippet action()}
				<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold {trendDown ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}">
					{trendLabel}
				</span>
			{/snippet}
			{#if trendHasHistory}
				<TrendChart actual={trendActual} ymin={trendYmin} ymax={trendYmax} color={color} height={210} />
			{:else}
				<p class="py-14 text-center text-[13px] text-text-3">
					Bu departman için yeterli geçmiş yok — güncel skor <b class="text-text-1">{score.toFixed(1)}</b>.<br />
					Trend, skorlama koştukça birikecek.
				</p>
			{/if}
		</SectionCard>

		<SectionCard title="Aktif hedefler" icon={Target} hint="ECHO takibi">
			<!-- Goals model not built yet (Faz 5.3) — kept as an empty section, not removed. -->
			<p class="py-8 text-center text-[13px] text-text-3">
				Henüz hedef tanımlı değil.<br />Hedef belirleme yakında gelecek.
			</p>
		</SectionCard>
	</div>

	<!-- Full category breakdown (alt kırılım) — REAL -->
	<div class="mb-3.5">
		<SectionCard title="{detail.label} kategorileri · tümü" icon={ListTree} hint="{breakdown.length} kategori · skor · mention · trend">
			{#if breakdown.length === 0}
				<p class="py-6 text-center text-[13px] text-text-3">Bu departman için kategori skoru yok.</p>
			{:else}
				<div class="flex flex-col">
					{#each breakdown as b (b.category)}
						{@const tone = b.headlineScore >= 70 ? 'text-success' : b.headlineScore >= 55 ? 'text-warning' : 'text-danger'}
						<div class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
							<div class="min-w-0">
								<span class="text-[13px] font-semibold text-text-1">{b.label}</span>
								<span class="ml-2 text-[11px] text-text-3">{b.mentionCount} mention</span>
							</div>
							<div class="flex items-center gap-2">
								{#if b.trend !== 0}
									<span class="text-[11px] font-bold {b.trend > 0 ? 'text-success' : 'text-danger'}">
										{b.trend > 0 ? '+' : ''}{b.trend.toFixed(1)}
									</span>
								{/if}
								<span class="text-[15px] font-extrabold {tone}">{b.headlineScore.toFixed(0)}</span>
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
			<MentionList items={issues} tone="issue" total={detail.reviewCount} emptyText="Şikâyet kaydı yok." />
		</SectionCard>
		<SectionCard title="Hedefe en hızlı yol" icon={Rocket} hint="kaldıraç sıralı">
			<OpportunityList items={opportunities} />
		</SectionCard>
	</div>

	<!-- Sentence-level mentions across this department's categories — REAL -->
	<SectionCard title="Mentions · {detail.label}" icon={MessageSquare} hint="cümle düzeyi · ABSA" class="mb-3.5">
		<MentionExplorer
			items={mentions}
			filter={mentionFilter}
			onfilter={setMentionFilter}
			loading={mentionsLoading}
		/>
	</SectionCard>

	<!-- Response analytics — real venue-wide rates; market rate [MOCK→radar]. -->
	<SectionCard title="Yanıt Yönetimi · {detail.label}" icon={MessageCircleReply} hint="duygu · pazar">
		<ResponseAnalytics
			overallRate={respAnalytics.overallRate}
			medianHours={respAnalytics.medianHours}
			bySentiment={respAnalytics.bySentiment}
			competitorAvgRate={respAnalytics.competitorAvgRate}
			overallLabel="{detail.label} yanıt oranı"
		/>
	</SectionCard>
{/if}
