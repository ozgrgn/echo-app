<!--
  MultiTrendChart — several GPI series on one axis (platform comparison). Pure SVG,
  no chart lib. The venue's own blended line ("Bizim") is drawn last, thick and in
  the brand color so it stands out; competitor/platform lines are thin and muted.
  All series are aligned to the longest period axis; shorter ones start later.
-->
<script lang="ts">
	interface Series {
		key: string;
		label: string;
		color: string;
		values: number[]; // oldest→newest, aligned to the END of the axis
		emphasis?: boolean; // our own line — thick + on top
	}
	interface Props {
		series: Series[];
		height?: number;
	}
	let { series, height = 230 }: Props = $props();

	const W = 740;
	const H = $derived(height);
	const pL = 34, pR = 12, pT = 12, pB = 26;

	// X axis length = the longest series; shorter series are right-aligned (recent).
	const n = $derived(Math.max(1, ...series.map((s) => s.values.length)));
	const allVals = $derived(series.flatMap((s) => s.values));
	const lo = $derived(allVals.length ? Math.min(...allVals) : 0);
	const hi = $derived(allVals.length ? Math.max(...allVals) : 100);
	const ymin = $derived(Math.floor(lo - 3));
	const ymax = $derived(Math.ceil(hi + 3));

	function X(i: number): number {
		return pL + (i / Math.max(1, n - 1)) * (W - pL - pR);
	}
	function Y(v: number): number {
		const t = (v - ymin) / Math.max(1, ymax - ymin);
		return H - pB - t * (H - pT - pB);
	}
	// Right-align a series: a 12-point series on a 24-slot axis starts at slot 12.
	function path(values: number[]): string {
		const offset = n - values.length;
		return values
			.map((v, i) => `${i ? 'L' : 'M'}${X(offset + i).toFixed(1)} ${Y(v).toFixed(1)}`)
			.join(' ');
	}

	const yticks = $derived([ymin, Math.round((ymin + ymax) / 2), ymax]);
	// Emphasis series drawn last (on top).
	const ordered = $derived([...series].sort((a, b) => (a.emphasis ? 1 : 0) - (b.emphasis ? 1 : 0)));
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" style="height:{H}px" role="img" aria-label="Platform GPI karşılaştırması">
	<!-- y gridlines + labels -->
	{#each yticks as t (t)}
		<line x1={pL} y1={Y(t)} x2={W - pR} y2={Y(t)} stroke="var(--color-surface-2)" stroke-width="1" />
		<text x={pL - 6} y={Y(t) + 3} text-anchor="end" font-size="10" fill="var(--color-text-3)">{t}</text>
	{/each}

	{#each ordered as s (s.key)}
		<path
			d={path(s.values)}
			fill="none"
			stroke={s.color}
			stroke-width={s.emphasis ? 3 : 1.5}
			stroke-linejoin="round"
			stroke-linecap="round"
			opacity={s.emphasis ? 1 : 0.55}
		/>
		<!-- endpoint dot -->
		{#if s.values.length}
			<circle cx={X(n - 1)} cy={Y(s.values[s.values.length - 1])} r={s.emphasis ? 3.5 : 2.5} fill={s.color} />
		{/if}
	{/each}
</svg>

<!-- Legend -->
<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
	{#each series as s (s.key)}
		<span class="inline-flex items-center gap-1.5 text-[11px] {s.emphasis ? 'font-bold text-text-1' : 'text-text-2'}">
			<i class="h-[3px] w-3 rounded-sm" style="background:{s.color}"></i>{s.label}
		</span>
	{/each}
</div>
