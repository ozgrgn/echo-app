<!--
  DeptCard — one clickable department tile in the Genel lens department grid.
  Clicking enters that department's lens (where goals can be set). Score colored
  by zone, with a trend arrow and the covered-categories hint.
-->
<script lang="ts">
	import type { OsDept } from '$lib/mock/os';
	import { ArrowUp, ArrowDown, Minus } from '@lucide/svelte';

	interface Props {
		dept: OsDept;
		onenter?: (key: string) => void;
	}

	let { dept, onenter }: Props = $props();

	const scoreColor = $derived(
		dept.score >= 70 ? 'text-success' : dept.score >= 55 ? 'text-warning' : 'text-danger'
	);
	const TrendIcon = $derived(dept.trend === 'up' ? ArrowUp : dept.trend === 'down' ? ArrowDown : Minus);
	const arrowClass = $derived(
		dept.trend === 'up' ? 'text-success' : dept.trend === 'down' ? 'text-danger' : 'text-text-3'
	);
</script>

<button
	onclick={() => dept.enters && onenter?.(dept.key)}
	class="flex flex-col rounded-xl p-3.5 text-left transition-colors hover:bg-surface-2"
>
	<span class="text-[12.5px] font-bold text-text-1">{dept.label}</span>
	<span class="mt-0.5 flex items-center gap-1.5 text-lg font-extrabold {scoreColor}">
		{dept.score}<span class="flex {arrowClass}"><TrendIcon size={14} strokeWidth={2.5} /></span>
	</span>
	<span class="mt-0.5 text-[10.5px] text-text-3">{dept.scope}</span>
</button>
