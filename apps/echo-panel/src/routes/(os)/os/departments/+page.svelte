<!--
  ECHO OS — Departmanlar (Departments) lens. Entry grid for the per-department
  detail lens (/os/department/[dept]). Department scores/trends are [MOCK→radar]
  (MOCK_OS_DEPTS) until the radar department-rollup endpoint lands. Clicking a
  card enters that department's detail lens.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { osState } from '$lib/stores/osState.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import DeptCard from '$lib/components/DeptCard.svelte';
	import { Users, TrendingDown, TrendingUp, ArrowLeft } from '@lucide/svelte';
	import { MOCK_OS_DEPTS } from '$lib/mock/os';
	import { DEPARTMENTS } from '$lib/mock/departments';

	// Back to the Genel lens — replaces the global LensTabs row on this page.
	function backToGenel() {
		osState.setLens({ kind: 'genel' });
		goto('/os');
	}

	// Short pill labels so the switcher row fits without wrapping.
	const SHORT_LABEL: Record<string, string> = {
		hk: 'Housekeeping',
		fnb: 'F&B',
		fo: 'Resepsiyon',
		anm: 'Animasyon',
		mnt: 'Teknik',
		spa: 'SPA',
		pnb: 'Havuz & Plaj',
		gr: 'Misafir İl.'
	};

	// Summary KPIs derived from the department list (live once radar lands).
	const avgScore = $derived(
		MOCK_OS_DEPTS.reduce((s, d) => s + d.score, 0) / MOCK_OS_DEPTS.length
	);
	const declining = $derived(MOCK_OS_DEPTS.filter((d) => d.trend === 'down'));
	const improving = $derived(MOCK_OS_DEPTS.filter((d) => d.trend === 'up'));
	// Weakest department drives the "önce neye bak" hint.
	const weakest = $derived([...MOCK_OS_DEPTS].sort((a, b) => a.score - b.score)[0]);

	function enterDept(key: string) {
		osState.setLens({ kind: 'department', department: key });
		goto(`/os/department/${key}`);
	}
</script>

<!-- Back to Genel + department switcher on one row (replaces the global LensTabs). -->
<div class="mb-3.5 flex flex-wrap items-center gap-2">
	<!-- Back button — sits first, same row as the department pills. -->
	<button
		onclick={backToGenel}
		class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
	>
		<ArrowLeft size={15} strokeWidth={2} />
		Geri
	</button>
	<span class="mx-0.5 h-5 w-px bg-border"></span>
	{#each MOCK_OS_DEPTS as d (d.key)}
		{@const color = DEPARTMENTS[d.key]?.color ?? 'var(--color-text-3)'}
		<button
			onclick={() => enterDept(d.key)}
			class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
			title={d.label}
		>
			<span class="h-2 w-2 rounded-full" style="background:{color}"></span>
			{SHORT_LABEL[d.key] ?? d.label}
		</button>
	{/each}
</div>

<!-- ── Hero band: same skeleton as the Genel/Platform lenses so they align ── -->
<div class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border border-border bg-surface-1 p-5 shadow-card">
	<div class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] bg-gradient-to-br from-[#4f46e5] to-[#a855f7] text-white">
		<Users size={24} strokeWidth={2} />
	</div>
	<div class="min-w-0">
		<div class="text-base font-extrabold tracking-tight text-text-1">Departmanlar</div>
		<div class="mt-0.5 text-xs text-text-3">{MOCK_OS_DEPTS.length} ekip · ekip bazlı performans · tıkla → detay</div>
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
		value={`${MOCK_OS_DEPTS.filter((x) => x.score >= 70).length}/${MOCK_OS_DEPTS.length}`}
		tone="success"
		emphasis="primary"
		caption="skor ≥ 70"
	/>
	<StatTile
		label="En zayıf"
		value={weakest ? `${weakest.score}` : '—'}
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
		{#each MOCK_OS_DEPTS as d (d.key)}
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
							<span class="text-[13px] font-extrabold text-danger">{d.score}</span>
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
							<span class="text-[13px] font-extrabold text-success">{d.score}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</SectionCard>
</div>
