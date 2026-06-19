<!--
  OpportunityList — "Önce neyi düzelt?" (prototype .opp). Ranks the lowest-scoring,
  most-mentioned categories as the highest-leverage fixes. Each row: rank, category,
  context (mentions · score), and an estimated GPI lift.

  REAL: category, mentionCount, headlineScore (from the snapshot). The estimated
  lift (+X GPI) is [MOCK→radar] — leverage math is radar's job; here it's a simple
  heuristic placeholder clearly labeled "tahmini".
-->
<script lang="ts">
	import { Zap } from '@lucide/svelte';

	interface Opportunity {
		rank: number;
		label: string;
		mentions: number;
		score: number;
		lift: string;       // e.g. "+4.2" — [MOCK→radar] estimate
		/** Optional ready-made context line; falls back to "{mentions} mention · skor {score}". */
		context?: string;
	}

	interface Props {
		items: Opportunity[];
	}

	let { items }: Props = $props();
</script>

<div class="flex flex-col gap-1">
	{#each items as o (o.rank)}
		<div class="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2">
			<span class="grid h-6 w-6 flex-none place-items-center rounded-lg bg-brand-light text-xs font-extrabold text-brand-dark">
				{o.rank}
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-[13px] font-bold text-text-1">{o.label}</span>
				<span class="block truncate text-[11px] text-text-3">{o.context ?? `${o.mentions} mention · skor ${o.score.toFixed(1)}`}</span>
			</span>
			<span class="flex-none text-right">
				<span class="block text-[13px] font-extrabold text-success">{o.lift} GPI</span>
				<span class="block text-[10px] text-text-3">tahmini</span>
			</span>
			<button class="grid h-7 w-7 flex-none place-items-center rounded-lg border border-border text-text-3 transition-colors hover:border-brand hover:text-brand" title="Aksiyon">
				<Zap size={14} />
			</button>
		</div>
	{/each}
</div>
