<!--
  MultiTrendChart — several GPI series on one axis (platform comparison). Pure SVG.
  The venue's own blended line ("Bizim") is emphasized: thicker, brand color, with
  a soft area fill, drawn on top. Competitor/platform lines are thinner and muted.
  Shorter series are right-aligned to the axis (so "now" is always the last slot).
-->
<script lang="ts">
	interface Series {
		key: string;
		label: string;
		color: string;
		values: number[]; // oldest→newest
		emphasis?: boolean;
	}
	interface Props {
		series: Series[];
		/** Period labels for the x-axis (aligned to the longest series). Monthly
		 *  'YYYY-MM' or, when `daily`, daily 'YYYY-MM-DD'. */
		periods?: string[];
		/** Periods are daily → tick labels read 'DD/MM' not 'MM/YY'. */
		daily?: boolean;
		height?: number;
	}
	let { series, periods = [], daily = false, height = 230 }: Props = $props();

	const W = 760;
	const H = $derived(height);
	const pL = 32, pR = 14, pT = 14, pB = 30;

	const n = $derived(Math.max(1, ...series.map((s) => s.values.length)));
	const allVals = $derived(series.flatMap((s) => s.values));
	const lo = $derived(allVals.length ? Math.min(...allVals) : 0);
	const hi = $derived(allVals.length ? Math.max(...allVals) : 100);
	// Pad the band a touch so lines never touch the edges.
	const ymin = $derived(Math.floor(lo - 2));
	const ymax = $derived(Math.ceil(hi + 2));

	function X(i: number): number {
		return pL + (i / Math.max(1, n - 1)) * (W - pL - pR);
	}
	function Y(v: number): number {
		const t = (v - ymin) / Math.max(1, ymax - ymin);
		return H - pB - t * (H - pT - pB);
	}
	function linePath(values: number[]): string {
		const offset = n - values.length;
		return values
			.map((v, i) => `${i ? 'L' : 'M'}${X(offset + i).toFixed(1)} ${Y(v).toFixed(1)}`)
			.join(' ');
	}
	// Area under the emphasized line (down to the baseline) for a soft fill.
	function areaPath(values: number[]): string {
		const offset = n - values.length;
		const base = H - pB;
		const top = values
			.map((v, i) => `${i ? 'L' : 'M'}${X(offset + i).toFixed(1)} ${Y(v).toFixed(1)}`)
			.join(' ');
		const x0 = X(offset).toFixed(1);
		const x1 = X(n - 1).toFixed(1);
		return `${top} L${x1} ${base} L${x0} ${base} Z`;
	}

	const yticks = $derived([ymax, Math.round((ymin + ymax) / 2), ymin]);
	// x labels: ~5 evenly spaced period ticks. Monthly → 'MM/YY'; daily → 'DD/MM'.
	const xticks = $derived.by(() => {
		if (periods.length === 0) return [];
		const step = Math.max(1, Math.ceil(periods.length / 5));
		const out: { i: number; label: string }[] = [];
		for (let i = 0; i < periods.length; i += step) {
			const [y, m, d] = periods[i].split('-');
			out.push({ i, label: daily ? `${d}/${m}` : `${m}/${y.slice(2)}` });
		}
		return out;
	});

	// Emphasis series drawn last (on top); others first.
	const ordered = $derived([...series].sort((a, b) => (a.emphasis ? 1 : 0) - (b.emphasis ? 1 : 0)));
	const ours = $derived(series.find((s) => s.emphasis));
	const uid = 'mtc-' + Math.round(W + H + series.length);
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" style="height:{H}px" role="img" aria-label="Platform GPI karşılaştırması">
	<defs>
		<linearGradient id="{uid}-fill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.18" />
			<stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0" />
		</linearGradient>
	</defs>

	<!-- y gridlines + labels -->
	{#each yticks as t (t)}
		<line x1={pL} y1={Y(t)} x2={W - pR} y2={Y(t)} stroke="var(--color-border)" stroke-width="1" stroke-dasharray="2 4" opacity="0.7" />
		<text x={pL - 6} y={Y(t) + 3} text-anchor="end" font-size="10" fill="var(--color-text-3)">{t}</text>
	{/each}

	<!-- x labels -->
	{#each xticks as xt (xt.i)}
		<text x={X(xt.i)} y={H - 9} text-anchor="middle" font-size="9.5" fill="var(--color-text-3)">{xt.label}</text>
	{/each}

	<!-- area fill under our line -->
	{#if ours && ours.values.length > 1}
		<path d={areaPath(ours.values)} fill="url(#{uid}-fill)" />
	{/if}

	{#each ordered as s (s.key)}
		<path
			d={linePath(s.values)}
			fill="none"
			stroke={s.color}
			stroke-width={s.emphasis ? 3.25 : 1.75}
			stroke-linejoin="round"
			stroke-linecap="round"
			opacity={s.emphasis ? 1 : 0.5}
		/>
		{#if s.values.length}
			<circle cx={X(n - 1)} cy={Y(s.values[s.values.length - 1])} r={s.emphasis ? 4 : 2.75} fill={s.color} />
			{#if s.emphasis}
				<circle cx={X(n - 1)} cy={Y(s.values[s.values.length - 1])} r="7" fill={s.color} opacity="0.18" />
			{/if}
		{/if}
	{/each}
</svg>

<!-- Legend -->
<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
	{#each series as s (s.key)}
		<span class="inline-flex items-center gap-1.5 text-[11.5px] {s.emphasis ? 'font-bold text-text-1' : 'text-text-2'}">
			<i class="h-[3px] rounded-sm {s.emphasis ? 'w-4' : 'w-3'}" style="background:{s.color}"></i>{s.label}
		</span>
	{/each}
</div>
