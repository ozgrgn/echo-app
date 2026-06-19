<!--
  GoalProgress — one active goal as a start→current→target bar (prototype .goal2).
  Fill = progress from start to current; a tick marks the target. Meta line shows
  scope + start + due with a risk/on-track badge. Progress % = (cur-start)/(tgt-start).
-->
<script lang="ts">
	import type { DeptGoal } from '$lib/mock/departments';
	import { TriangleAlert, Check } from '@lucide/svelte';

	interface Props {
		goal: DeptGoal;
		accent?: string;
	}
	let { goal, accent = 'var(--color-talkwo)' }: Props = $props();

	// Normalize the bar window around start/current/target with a little padding.
	const lo = $derived(Math.min(goal.start, goal.current, goal.target) - 4);
	const hi = $derived(Math.max(goal.start, goal.current, goal.target) + 4);
	const rng = $derived(hi - lo || 1);
	const curPct = $derived(((goal.current - lo) / rng) * 100);
	const tgtPct = $derived(((goal.target - lo) / rng) * 100);
</script>

<div class="py-1">
	<div class="mb-1.5 flex items-center justify-between text-[12.5px]">
		<span class="font-bold text-text-1">{goal.name}</span>
		<span class="font-bold" style="color:{accent}">{goal.current} → {goal.target}</span>
	</div>
	<div class="relative h-2 overflow-hidden rounded-full bg-surface-2">
		<div class="absolute left-0 top-0 bottom-0 rounded-full" style="width:{curPct}%;background:{accent}"></div>
		<div class="absolute -top-0.5 -bottom-0.5 w-0.5 bg-text-1/40" style="left:{tgtPct}%"></div>
	</div>
	<div class="mt-1.5 flex items-center justify-between text-[10.5px] text-text-3">
		<span>{goal.scope} · başlangıç {goal.start}</span>
		<span
			class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold
				{goal.status === 'risk' ? 'bg-warning-light text-warning' : 'bg-success-light text-success'}"
		>
			{#if goal.status === 'risk'}
				<TriangleAlert size={11} />risk
			{:else}
				<Check size={11} />yolunda
			{/if}
			· {goal.due}
		</span>
	</div>
</div>
