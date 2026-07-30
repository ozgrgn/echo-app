<!--
  ECHO OS — Departmanlar (Departments) lens. Entry grid for the per-department
  detail lens (/os/department/[dept]). Department scores/trends are REAL: rolled
  up from the venue's per-category scores by taxonomy primaryOwner
  (GET /v1/departments/:slug) — the single source; the old MOCK_OS_DEPTS fallback
  is gone, so no data renders as an empty state. Clicking a card enters that
  department's detail lens.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { osState } from '$lib/stores/osState.svelte';
	import { zoneClass, gpiZone } from '@talkwo/echo-core';
	import { windowParam, parseOsWindow, parseCustomRange } from '$lib/config/window';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import DeptCard from '$lib/components/DeptCard.svelte';
	import OsBackNav from '$lib/components/OsBackNav.svelte';
	import CustomRangeBanner from '$lib/components/CustomRangeBanner.svelte';
	import { Users, TrendingDown, TrendingUp } from '@lucide/svelte';
	import { type DepartmentScore } from '@talkwo/echo-ui';
	import { DEPARTMENTS } from '$lib/mock/departments';
	import type { OsDept } from '$lib/mock/os';

	// ── Real department rollup — the only source ────────────────────────────────
	let realDepts = $state<DepartmentScore[] | null>(null);
	let loading = $state(false);
	let errored = $state(false);

	// Custom mode: the day the cards are actually as of (nearest row ≤ `to`). Drives the
	// mandatory "… itibarıyla" label — a range ending on a gap day is served from an
	// earlier row, and an unlabelled card there would claim a date it isn't.
	let effectiveDate = $state<string | null>(null);
	// The banner wants {from, to, effectiveDate}. from/to come from the URL (this lens
	// reads a day, not a bundle, so nothing echoes them back); effectiveDate comes from
	// the response. Null until both exist — a half-filled banner would be worse than none.
	const bannerRange = $derived.by(() => {
		const c = parseCustomRange(page.url.searchParams);
		return c && effectiveDate ? { from: c.from, to: c.to, effectiveDate } : null;
	});

	async function load(window: string | undefined, asof?: string) {
		loading = true;
		errored = false;
		try {
			// asof and window are alternatives, not companions: in custom mode the backend
			// reads the daily row for that day (its own default series), so sending a fixed
			// window alongside it would only invite the two to disagree.
			const qs = new URLSearchParams({
				resource: 'departments',
				...(asof ? { asof } : window ? { window } : {})
			});
			const r = await fetch(`/api/os/data?${qs}`);
			const res = r.ok ? await r.json() : { departments: [] };
			realDepts = res.departments;
			effectiveDate = res.effectiveDate ?? null;
		} catch {
			errored = true;
			realDepts = null;
			effectiveDate = null;
		} finally {
			loading = false;
		}
	}
	// Re-fetch when the global window changes (reading page.url inside the effect
	// subscribes it to the rail selector's ?window= updates). G12: a custom range asks for
	// its END day instead of a window — this lens used to fall back to 6mo while the rail
	// lit "Özel", so the page silently disagreed with the selector above it.
	$effect(() => {
		const custom = parseCustomRange(page.url.searchParams);
		if (custom) load(undefined, custom.to);
		else load(windowParam(parseOsWindow(page.url.searchParams.get('window'))));
	});

	// Adapt a real DepartmentScore into the OsDept shape DeptCard/switcher expect.
	// A null score (no mentions) stays null — DeptCard renders it as a neutral '—'
	// ("yeterli veri yok"). It used to be coerced to 0 here, which painted an
	// insufficient-data department as a catastrophic red zero on the grid.
	//
	// Direction is threshold-FREE: any non-zero movement counts (a mature venue moves
	// ±0.1/month, and a 0.5 threshold made "Düşüşte/Yükselişte olanlar" permanently
	// empty). The movement lists then RANK by trendValue, so tiny-but-real changes still
	// surface the department to look at first. Only an exact 0 (no prior period) is flat.
	function toOsDept(d: DepartmentScore): OsDept {
		return {
			key: d.key,
			label: d.label,
			score: d.score,
			trend: d.trend > 0 ? 'up' : d.trend < 0 ? 'down' : 'flat',
			trendValue: d.trend,
			scope: d.categories.join(' · '),
			enters: d.score != null,
			mentions: d.mentionCount ?? null
		};
	}

	// Worst-first is already the backend order; keep it. Empty until it answers —
	// there is no invented fallback set any more.
	const depts = $derived<OsDept[]>(realDepts ? realDepts.map(toOsDept) : []);

	// Summary KPIs use the SCORED departments only (null = insufficient mentions, not 0).
	// The grid shows BOTH: scored tiles first, thin (unscored) tiles last as "veri az ·
	// N mention" — a narrow window (6mo default) must say "too little data", never let a
	// department silently vanish or read as "veri yok" (Özgür: "veri yok demesin, veri az").
	const scored = $derived(
		depts.filter((d): d is OsDept & { score: number } => d.score != null)
	);
	const thin = $derived(depts.filter((d) => d.score == null));
	const avgScore = $derived(
		scored.length ? scored.reduce((s, d) => s + d.score, 0) / scored.length : 0
	);
	// Rank the movement lists by the raw delta: steepest drop first (that's the
	// priority), strongest gain first.
	const declining = $derived(
		depts.filter((d) => d.trend === 'down').sort((a, b) => (a.trendValue ?? 0) - (b.trendValue ?? 0))
	);
	const improving = $derived(
		depts.filter((d) => d.trend === 'up').sort((a, b) => (b.trendValue ?? 0) - (a.trendValue ?? 0))
	);
	// Stable = trend is exactly flat (no prior period OR zero movement) — the third
	// bucket that completes the trend split (down + up + flat = total). Shown as a
	// count instead of the old "En zayıf" score so the KPI strip reads one universe.
	const stable = $derived(depts.filter((d) => d.trend === 'flat'));

	function enterDept(key: string) {
		osState.setLens({ kind: 'department', department: key });
		goto(`/os/department/${key}`);
	}
</script>

<!-- G12: cards are as-of the range end, so say which day they speak for. -->
<CustomRangeBanner range={bannerRange} />

<!-- Home (→ main page) + department switcher on one row. This is a LIST page (one hop
     from Genel), so no "Geri" — Home already IS one level up. -->
<OsBackNav>
	{#each scored as d (d.key)}
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
</OsBackNav>

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
	<div class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border border-border bg-surface-1 p-5 shadow-card max-md:flex-nowrap max-md:gap-3 max-md:p-3.5">
		<div class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] bg-gradient-to-br from-[#4f46e5] to-[#a855f7] text-white max-md:h-9 max-md:w-9 max-md:rounded-[10px]">
			<Users size={24} strokeWidth={2} />
		</div>
		<div class="min-w-0">
			<div class="text-base font-extrabold tracking-tight text-text-1 max-md:truncate">Departmanlar</div>
			<div class="mt-0.5 text-xs text-text-3 max-md:truncate">{depts.length} ekip · ekip bazlı performans · tıkla → detay</div>
		</div>
		<div class="ml-auto flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Departman Ort.</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight max-md:text-[26px] {zoneClass(avgScore)}">{avgScore.toFixed(0)}</span>
		</div>
	</div>

	<!-- ── KPI strip ─────────────────────────────────────────────────────────── -->
	<div class="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
		<StatTile
			label="İyi durumda"
			metricId="reviews.departments.gpi"
			value={`${scored.filter((x) => gpiZone(x.score) === 'green').length}/${scored.length}`}
			tone="success"
			emphasis="primary"
			caption="skor ≥ 70"
		/>
		<StatTile
			label="Yükselişte"
			value={`${improving.length}`}
			tone={improving.length > 0 ? 'success' : 'neutral'}
			caption="trend yukarı"
		/>
		<StatTile
			label="Stabil"
			value={`${stable.length}`}
			tone="neutral"
			caption="trend düz"
		/>
		<StatTile
			label="Düşüşte"
			value={`${declining.length}`}
			tone={declining.length > 0 ? 'warning' : 'neutral'}
			caption="trend aşağı"
		/>
	</div>

	<!-- ── Department grid ───────────────────────────────────────────────────── -->
	<SectionCard title="Departmanlar" icon={Users} metricId="reviews.departments.gpi" hint="tıkla → ekip detayı" class="mb-3.5">
		<div class="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
			{#each scored as d (d.key)}
				<DeptCard dept={d} onenter={enterDept} />
			{/each}
			{#each thin as d (d.key)}
				<DeptCard dept={d} onenter={enterDept} />
			{/each}
		</div>
	</SectionCard>

	<!-- ── Quick movement lists ──────────────────────────────────────────────── -->
	<div class="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
		<SectionCard title="Düşüşte olanlar" icon={TrendingDown} hint="öncelik · trend son 30 gün">
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
									<span class="text-[13px] font-extrabold text-danger">{d.score?.toFixed(0) ?? '—'}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</SectionCard>

		<SectionCard title="Yükselişte olanlar" icon={TrendingUp} hint="momentum · trend son 30 gün">
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
									<span class="text-[13px] font-extrabold text-success">{d.score?.toFixed(0) ?? '—'}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</SectionCard>
	</div>
{/if}
