<!--
  Department lens (prototype #view-hk, generalized to all departments). Full set:
  switcher + hero + active goals + score trend + the complete subcategory ("alt
  kırılım") breakdown + complaints + highest-leverage fixes. All rich mock.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { osState } from '$lib/stores/osState.svelte';

	import DeptHero from '$lib/components/DeptHero.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import GoalProgress from '$lib/components/GoalProgress.svelte';
	import SubcategoryGrid from '$lib/components/SubcategoryGrid.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import MentionList from '$lib/components/MentionList.svelte';
	import OpportunityList from '$lib/components/OpportunityList.svelte';
	import { Target, TrendingDown, TrendingUp, ListTree, CircleAlert, Rocket } from '@lucide/svelte';

	let { data } = $props();
	const d = $derived(data.dept);

	// Trend chart window from the score series.
	const ymin = $derived(Math.floor(Math.min(...d.scoreTrend, d.target) - 6));
	const ymax = $derived(Math.ceil(Math.max(...d.scoreTrend, d.target) + 6));

	// Opportunities → OpportunityList shape (rank + label + context + lift).
	const opportunities = $derived(
		d.opportunities.map((o, i) => ({
			rank: i + 1, label: o.label, mentions: 0, score: 0, lift: o.lift, context: o.context,
		}))
	);

	function switchTo(key: string) {
		if (key === d.key) return;
		osState.setLens({ kind: 'department', department: key });
		goto(`/os/department/${key}`);
	}
</script>

<!-- Department switcher -->
<div class="mb-3.5 flex flex-wrap items-center gap-2">
	{#each data.siblings as s (s.key)}
		{@const active = s.key === d.key}
		<button
			onclick={() => switchTo(s.key)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{active ? 'border-transparent text-white' : 'border-border bg-surface-1 text-text-2 hover:bg-surface-2'}"
			style={active ? `background:${s.color}` : ''}
		>
			<span class="h-2 w-2 rounded-full" style="background:{active ? 'rgba(255,255,255,0.8)' : s.color}"></span>
			{s.label}
		</button>
	{/each}
</div>

<DeptHero dept={d} />

<!-- Score trend + active goals -->
<div class="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
	<SectionCard title="Departman skoru trendi" icon={d.trendDir === 'down' ? TrendingDown : TrendingUp}>
		{#snippet action()}
			<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold {d.trendDir === 'down' ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}">
				{d.trendDir === 'down' ? 'Düşüşte' : d.trendDir === 'up' ? 'Yükselişte' : 'Sabit'}
			</span>
		{/snippet}
		<div class="mb-3 flex flex-wrap gap-2">
			<span class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-text-2"><i class="h-[3px] w-2.5 rounded-sm" style="background:{d.color}"></i>Skor</span>
			<span class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-text-2"><i class="h-[3px] w-2.5 rounded-sm" style="background:var(--color-text-3)"></i>Hedef {d.target}</span>
		</div>
		<TrendChart actual={d.scoreTrend} target={d.target} {ymin} {ymax} color={d.color} height={210} />
	</SectionCard>

	<SectionCard title="Aktif hedefler" icon={Target} hint="ECHO takibi">
		<div class="flex flex-col gap-3">
			{#each d.goals as g (g.name)}
				<GoalProgress goal={g} accent={d.color} />
			{/each}
		</div>
	</SectionCard>
</div>

<!-- Full subcategory breakdown (alt kırılım) -->
<div class="mb-3.5">
	<SectionCard title="{d.label} alt-başlıkları · tümü" icon={ListTree} hint="{d.subs.length} başlık · skor · mention · trend">
		<SubcategoryGrid subs={d.subs} />
	</SectionCard>
</div>

<!-- Complaints + leverage -->
<div class="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
	<SectionCard title="Skoru düşüren şikâyetler" icon={CircleAlert} hint="son 30 gün">
		<MentionList items={d.issues} tone="issue" total={d.reviewCount} />
	</SectionCard>
	<SectionCard title="Hedefe en hızlı yol" icon={Rocket} hint="kaldıraç sıralı">
		<OpportunityList items={opportunities} />
	</SectionCard>
</div>
