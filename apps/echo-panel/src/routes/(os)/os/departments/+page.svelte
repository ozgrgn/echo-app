<!--
  ECHO OS — Departmanlar (Departments) lens. Entry grid for the per-department
  detail lens (/os/department/[dept]). Department scores/trends are REAL: rolled
  up from the venue's per-category scores by taxonomy primaryOwner
  (GET /v1/departments/:slug). Mock demo data is used only in osDataSource mock
  mode. Clicking a card enters that department's detail lens.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { osState } from '$lib/stores/osState.svelte';
	import { osDataSource } from '$lib/stores/osDataSource.svelte';
	import { windowParam, parseOsWindow } from '$lib/config/window';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import DeptCard from '$lib/components/DeptCard.svelte';
	import { Users, TrendingDown, TrendingUp, ArrowLeft } from '@lucide/svelte';
	import { type DepartmentScore } from '@talkwo/echo-ui';
	import { MOCK_OS_DEPTS } from '$lib/mock/os';
	import { DEPARTMENTS } from '$lib/mock/departments';
	import type { OsDept } from '$lib/mock/os';

	// Back to the Genel lens — replaces the global LensTabs row on this page.
	function backToGenel() {
		osState.setLens({ kind: 'genel' });
		goto('/os');
	}

	// ── Real department rollup (mock only in demo mode) ─────────────────────────
	let realDepts = $state<DepartmentScore[] | null>(null);
	let loading = $state(false);
	let errored = $state(false);

	async function load(window: string | undefined) {
		if (osDataSource.isMock) {
			realDepts = null;
			return;
		}
		loading = true;
		errored = false;
		try {
			const qs = new URLSearchParams({ resource: 'departments', ...(window ? { window } : {}) });
			const r = await fetch(`/api/os/data?${qs}`);
			const res = r.ok ? await r.json() : { departments: [] };
			realDepts = res.departments;
		} catch {
			errored = true;
			realDepts = null;
		} finally {
			loading = false;
		}
	}
	// Re-fetch when the global window changes (reading page.url inside the effect
	// subscribes it to the rail selector's ?window= updates).
	$effect(() => {
		load(windowParam(parseOsWindow(page.url.searchParams.get('window'))));
	});

	// Adapt a real DepartmentScore into the OsDept shape DeptCard/switcher expect.
	// A null score (no mentions) sorts last and renders as 0 with a flat trend.
	//
	// Direction is threshold-FREE: any non-zero movement counts (a mature venue moves
	// ±0.1/month, and a 0.5 threshold made "Düşüşte/Yükselişte olanlar" permanently
	// empty). The movement lists then RANK by trendValue, so tiny-but-real changes still
	// surface the department to look at first. Only an exact 0 (no prior period) is flat.
	function toOsDept(d: DepartmentScore): OsDept {
		return {
			key: d.key,
			label: d.label,
			score: d.score ?? 0,
			trend: d.trend > 0 ? 'up' : d.trend < 0 ? 'down' : 'flat',
			trendValue: d.trend,
			scope: d.categories.join(' · '),
			enters: d.score != null
		};
	}

	// Live list (real when available, mock otherwise). Worst-first is already the
	// backend order; keep it. Departments with data only.
	const depts = $derived<OsDept[]>(
		realDepts ? realDepts.map(toOsDept) : MOCK_OS_DEPTS
	);

	// Summary KPIs derived from whatever list is active.
	const scored = $derived(depts.filter((d) => d.enters !== false));
	const avgScore = $derived(
		scored.length ? scored.reduce((s, d) => s + d.score, 0) / scored.length : 0
	);
	// Rank the movement lists by the raw delta: steepest drop first (that's the
	// priority), strongest gain first. Falls back to 0 for the mock set (no trendValue).
	const declining = $derived(
		depts.filter((d) => d.trend === 'down').sort((a, b) => (a.trendValue ?? 0) - (b.trendValue ?? 0))
	);
	const improving = $derived(
		depts.filter((d) => d.trend === 'up').sort((a, b) => (b.trendValue ?? 0) - (a.trendValue ?? 0))
	);
	const weakest = $derived([...scored].sort((a, b) => a.score - b.score)[0]);

	function enterDept(key: string) {
		osState.setLens({ kind: 'department', department: key });
		goto(`/os/department/${key}`);
	}
</script>

<!-- Back to Genel + department switcher on one row (replaces the global LensTabs). -->
<div class="mb-3.5 flex flex-wrap items-center gap-2">
	<button
		onclick={backToGenel}
		class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
	>
		<ArrowLeft size={15} strokeWidth={2} />
		Geri
	</button>
	<span class="mx-0.5 h-5 w-px bg-border"></span>
	{#each depts as d (d.key)}
		{@const color = DEPARTMENTS[d.key]?.color ?? 'var(--color-text-3)'}
		<button
			onclick={() => enterDept(d.key)}
			class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
			title={d.label}
		>
			<span class="h-2 w-2 rounded-full" style="background:{color}"></span>
			{d.label}
		</button>
	{/each}
</div>

{#if loading}
	<p class="py-16 text-center text-sm text-text-3">Departmanlar yükleniyor…</p>
{:else if errored}
	<p class="py-16 text-center text-sm text-text-3">Departman verisi alınamadı. Sayfayı yenileyin.</p>
{:else if depts.length === 0}
	<p class="py-16 text-center text-sm text-text-3">
		Henüz departman skoru yok — yeterli analizli yorum biriktiğinde burada görünecek.
	</p>
{:else}
	<!-- ── Hero band: same skeleton as the Genel/Platform lenses so they align ── -->
	<div class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border border-border bg-surface-1 p-5 shadow-card">
		<div class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] bg-gradient-to-br from-[#4f46e5] to-[#a855f7] text-white">
			<Users size={24} strokeWidth={2} />
		</div>
		<div class="min-w-0">
			<div class="text-base font-extrabold tracking-tight text-text-1">Departmanlar</div>
			<div class="mt-0.5 text-xs text-text-3">{depts.length} ekip · ekip bazlı performans · tıkla → detay</div>
		</div>
		<div class="ml-auto flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Departman Ort.</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight {avgScore >= 70 ? 'text-success' : avgScore >= 55 ? 'text-warning' : 'text-danger'}">{avgScore.toFixed(0)}</span>
		</div>
	</div>

	<!-- ── KPI strip ─────────────────────────────────────────────────────────── -->
	<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
		<StatTile
			label="İyi durumda"
			value={`${scored.filter((x) => x.score >= 70).length}/${scored.length}`}
			tone="success"
			emphasis="primary"
			caption="skor ≥ 70"
		/>
		<StatTile
			label="En zayıf"
			value={weakest ? `${weakest.score.toFixed(0)}` : '—'}
			tone="danger"
			caption={weakest?.label ?? '—'}
		/>
		<StatTile
			label="Düşüşte"
			value={`${declining.length}`}
			tone={declining.length > 0 ? 'warning' : 'neutral'}
			caption="trend aşağı"
		/>
		<StatTile
			label="Yükselişte"
			value={`${improving.length}`}
			tone={improving.length > 0 ? 'success' : 'neutral'}
			caption="trend yukarı"
		/>
	</div>

	<!-- ── Department grid ───────────────────────────────────────────────────── -->
	<SectionCard title="Departmanlar" icon={Users} hint="tıkla → ekip detayı" class="mb-3.5">
		<div class="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
			{#each depts as d (d.key)}
				<DeptCard dept={d} onenter={enterDept} />
			{/each}
		</div>
	</SectionCard>

	<!-- ── Quick movement lists ──────────────────────────────────────────────── -->
	<div class="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
		<SectionCard title="Düşüşte olanlar" icon={TrendingDown} hint="öncelik">
			{#if declining.length === 0}
				<p class="py-4 text-center text-[13px] text-text-3">Düşüşte departman yok.</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each declining as d (d.key)}
						<li>
							<button onclick={() => enterDept(d.key)} class="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2">
								<span class="text-[13px] font-semibold text-text-1">{d.label}</span>
								<span class="flex items-center gap-2">
									{#if d.trendValue != null}
										<span class="text-[11px] font-semibold text-danger">▼ {Math.abs(d.trendValue).toFixed(2)}</span>
									{/if}
									<span class="text-[13px] font-extrabold text-danger">{d.score.toFixed(0)}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</SectionCard>

		<SectionCard title="Yükselişte olanlar" icon={TrendingUp} hint="momentum">
			{#if improving.length === 0}
				<p class="py-4 text-center text-[13px] text-text-3">Yükselişte departman yok.</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each improving as d (d.key)}
						<li>
							<button onclick={() => enterDept(d.key)} class="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2">
								<span class="text-[13px] font-semibold text-text-1">{d.label}</span>
								<span class="flex items-center gap-2">
									{#if d.trendValue != null}
										<span class="text-[11px] font-semibold text-success">▲ {Math.abs(d.trendValue).toFixed(2)}</span>
									{/if}
									<span class="text-[13px] font-extrabold text-success">{d.score.toFixed(0)}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</SectionCard>
	</div>
{/if}
