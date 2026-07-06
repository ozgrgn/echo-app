<!--
  TrendChart — area line + target line + dashed projection, pure SVG.
  Port of the prototype's line() helper (talkwo-echo-app.html). No chart lib.

  actual: realized series (oldest→newest). projection: dashed forecast continuing
  from the last actual point (radar "gidişat"). target: horizontal goal line.
-->
<script lang="ts">
	interface Props {
		actual: number[];
		projection?: number[];
		target?: number;
		targetLabel?: string;
		ymin: number;
		ymax: number;
		yticks?: number[];
		color?: string;
		height?: number;
		/**
		 * Period labels for the x-axis, aligned to `actual` (oldest→newest, one per
		 * actual point). Optional — omit to keep the axis label-free (back-compat).
		 * Projection slots carry no period, so ticks only span the actual region.
		 */
		periods?: string[];
	}

	let {
		actual,
		projection = [],
		target,
		targetLabel = 'Hedef',
		ymin,
		ymax,
		yticks,
		color = 'var(--color-brand)',
		height = 260,
		periods = []
	}: Props = $props();

	const W = 740;
	const H = $derived(height);
	const pL = 38, pR = 20, pT = 16, pB = 28;

	// Projection shares the last actual point, so total x-slots = actual + (proj-1).
	const n = $derived(actual.length + Math.max(0, projection.length - 1));
	const ticks = $derived(yticks ?? [ymin, (ymin + ymax) / 2, ymax]);

	const X = (i: number) => pL + (i * (W - pL - pR)) / (n - 1);
	const Y = (v: number) => pT + ((ymax - v) / (ymax - ymin)) * (H - pT - pB);

	const actualPts = $derived(actual.map((v, i) => [X(i), Y(v)] as const));
	const actualLine = $derived(
		actualPts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
	);
	const areaPath = $derived(
		`${actualLine} L ${X(actual.length - 1).toFixed(1)} ${Y(ymin)} L ${pL} ${Y(ymin)} Z`
	);
	const projPts = $derived(
		projection.map((v, i) => [X(actual.length - 1 + i), Y(v)] as const)
	);
	const projLine = $derived(
		projPts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
	);
	const lastPt = $derived(actualPts[actualPts.length - 1]);

	// x labels: ~5 evenly spaced 'MM/YY' period ticks over the actual region only
	// (projection slots have no period). Always include the newest period.
	const xticks = $derived.by(() => {
		if (periods.length === 0) return [];
		const last = periods.length - 1;
		const step = Math.max(1, Math.ceil(periods.length / 5));
		const idxs: number[] = [];
		for (let i = 0; i < periods.length; i += step) idxs.push(i);
		if (idxs[idxs.length - 1] !== last) idxs.push(last);
		return idxs.map((i) => {
			const [y, m] = periods[i].split('-');
			return { x: X(i), label: `${m}/${y.slice(2)}` };
		});
	});
</script>

<svg
	viewBox="0 0 {W} {H}"
	preserveAspectRatio="xMidYMid meet"
	style="width:100%;height:{height}px;max-height:{height}px;display:block"
	role="img"
>
	<!-- gridlines + y labels -->
	{#each ticks as t (t)}
		<line x1={pL} y1={Y(t)} x2={W - pR} y2={Y(t)} stroke="var(--color-surface-3)" stroke-width="1" />
		<text x={pL - 7} y={Y(t) + 4} text-anchor="end" font-size="10.5" fill="var(--color-text-3)">{t}</text>
	{/each}

	<!-- x period labels -->
	{#each xticks as xt (xt.x)}
		<text x={xt.x} y={H - 8} text-anchor="middle" font-size="10" fill="var(--color-text-3)">{xt.label}</text>
	{/each}

	<!-- target line — label anchored LEFT so it never collides with the end-point
	     value (which always sits at the right edge). -->
	{#if target !== undefined}
		<line x1={pL} y1={Y(target)} x2={W - pR} y2={Y(target)} stroke="var(--color-text-3)" stroke-width="1.4" stroke-dasharray="5 5" />
		<text x={pL + 4} y={Y(target) - 5} text-anchor="start" font-size="10.5" font-weight="700" fill="var(--color-text-2)">{targetLabel} {target}</text>
	{/if}

	<!-- actual area + line -->
	<path d={areaPath} fill={color} fill-opacity="0.12" />
	<path d={actualLine} fill="none" stroke={color} stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />

	<!-- projection (dashed amber) -->
	{#if projPts.length}
		<path d={projLine} fill="none" stroke="var(--color-warning)" stroke-width="2.8" stroke-dasharray="7 5" stroke-linecap="round" />
	{/if}

	<!-- end dot + value -->
	{#if lastPt}
		<circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill={color} stroke="#fff" stroke-width="2" />
		<text x={lastPt[0]} y={lastPt[1] - 11} text-anchor="middle" font-size="11.5" font-weight="800" fill={color}>
			{actual[actual.length - 1]}
		</text>
	{/if}
</svg>
