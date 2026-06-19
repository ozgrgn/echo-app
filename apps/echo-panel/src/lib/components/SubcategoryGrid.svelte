<!--
  SubcategoryGrid — the department's full "alt kırılım" breakdown (prototype .subgrid).
  Each row: subcategory name + its taxonomy category (small) · zone-colored score bar
  · score · mention count · trend. Two columns on wide screens.
-->
<script lang="ts">
	import type { DeptSub } from '$lib/mock/departments';
	import { ArrowUp, ArrowDown, Minus } from '@lucide/svelte';

	interface Props {
		subs: DeptSub[];
	}
	let { subs }: Props = $props();

	const zoneColor = (s: number) =>
		s >= 70 ? 'var(--color-success)' : s >= 55 ? 'var(--color-warning)' : 'var(--color-danger)';
	const TrendIcon = (t: DeptSub['trend']) => (t === 'up' ? ArrowUp : t === 'down' ? ArrowDown : Minus);
	const trendClass = (t: DeptSub['trend']) =>
		t === 'up' ? 'text-success' : t === 'down' ? 'text-danger' : 'text-text-3';
</script>

<div class="grid grid-cols-1 gap-x-8 md:grid-cols-2">
	{#each subs as s (s.name)}
		{@const Icon = TrendIcon(s.trend)}
		<div class="flex items-center gap-3 border-t border-surface-2 py-2.5 first:border-t-0 md:[&:nth-child(2)]:border-t-0">
			<div class="w-[120px] flex-none">
				<div class="text-[12.5px] font-semibold text-text-1">{s.name}</div>
				<div class="text-[10px] font-medium text-text-3">{s.cat}</div>
			</div>
			<span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
				<span class="block h-full rounded-full" style="width:{s.score}%;background:{zoneColor(s.score)}"></span>
			</span>
			<span class="w-7 text-right text-[12.5px] font-extrabold" style="color:{zoneColor(s.score)}">{s.score}</span>
			<span class="w-[58px] text-right text-[10.5px] text-text-3">{s.mentions} mention</span>
			<span class="flex w-4 justify-end {trendClass(s.trend)}"><Icon size={13} strokeWidth={2.5} /></span>
		</div>
	{/each}
</div>
