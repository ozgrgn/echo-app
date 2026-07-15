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
		/** Review count for the current window — shown in the legend. */
		count?: number;
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
	// Catmull-Rom spline (passes through every point) → smooth line, matching
	// TrendChart. Falls back to straight lines for <3 points.
	function smooth(pts: [number, number][], tension = 1): string {
		if (pts.length < 3) {
			return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
		}
		const f = (v: number) => v.toFixed(1);
		let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i === 0 ? 0 : i - 1];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
			const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
			const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
			const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
			const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
			d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
		}
		return d;
	}
	function linePath(values: number[]): string {
		const offset = n - values.length;
		return smooth(values.map((v, i) => [X(offset + i), Y(v)]));
	}
	// Area under the emphasized line (down to the baseline) for a soft fill.
	function areaPath(values: number[]): string {
		const offset = n - values.length;
		const base = H - pB;
		const top = smooth(values.map((v, i) => [X(offset + i), Y(v)]));
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

	// ── Hover: snap to nearest column, show every series' value there ─────────
	let svgEl: SVGSVGElement | null = $state(null);
	let hoverI = $state<number | null>(null);

	function onMove(e: PointerEvent) {
		if (!svgEl || n === 0) return;
		const rect = svgEl.getBoundingClientRect();
		const svgX = ((e.clientX - rect.left) / rect.width) * W;
		let best = 0, bestD = Infinity;
		for (let i = 0; i < n; i++) {
			const d = Math.abs(X(i) - svgX);
			if (d < bestD) { bestD = d; best = i; }
		}
		hoverI = best;
	}
	function onLeave() { hoverI = null; }

	// For a hovered column index, each series' value at that column (series are
	// right-aligned, so column i maps to values[i - offset]).
	const hoverRows = $derived.by(() => {
		if (hoverI === null) return [];
		return ordered
			.map((s) => {
				const offset = n - s.values.length;
				const vi = hoverI! - offset;
				if (vi < 0 || vi >= s.values.length) return null;
				return { label: s.label, color: s.color, value: s.values[vi], count: s.count, emphasis: s.emphasis };
			})
			.filter((r): r is NonNullable<typeof r> => r !== null)
			.sort((a, b) => b.value - a.value); // highest GPI first
	});
	const hoverX = $derived(hoverI === null ? 0 : X(hoverI));
	const hoverDate = $derived(hoverI !== null && periods[hoverI] ? fmtPeriod(periods[hoverI]) : '');

	function fmtPeriod(p: string): string {
		const [y, m, d] = p.split('-');
		return daily ? `${d}.${m}.${y}` : `${m}/${y}`;
	}

	// Tooltip box geometry (header + one row per series). Each row lays out three
	// right-anchored columns: label (left), review-count (middle, e.g. "· 174"),
	// GPI value (right). ttValW/ttCountW reserve width so columns never overlap.
	const ttRows = $derived(hoverDate ? hoverRows.length + 1 : hoverRows.length);
	const ttValW = 30; // GPI value column ("91.5"), right edge of the box
	const ttCountW = $derived(
		hoverRows.some((r) => r.count !== undefined)
			? Math.max(...hoverRows.map((r) => (r.count !== undefined ? (`· ${r.count.toLocaleString('tr-TR')}`).length : 0))) * 5.6 + 8
			: 0
	);
	const ttW = $derived(Math.max(96, ...hoverRows.map((r) => (r.label.length + 6) * 6.4 + 22)) + ttCountW);
	const ttH = $derived(ttRows * 15 + 10);
	// Anchor the tooltip to a fixed top corner instead of following the cursor
	// horizontally — a cursor-tracked box flips sides mid-chart and reads as jitter.
	// Only the crosshair tracks the pointer. When the pointer is on the right half
	// we park the box top-left (and vice-versa) so it never sits under the cursor.
	const ttX = $derived(hoverX > W / 2 ? pL + 6 : W - pR - ttW - 6);
	const ttY = $derived(pT + 4);
</script>

<svg bind:this={svgEl} viewBox="0 0 {W} {H}" class="w-full" style="height:{H}px" role="img" aria-label="Platform GPI karşılaştırması" onpointermove={onMove} onpointerleave={onLeave}>
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
			pathLength="1"
			fill="none"
			stroke={s.color}
			stroke-width={s.emphasis ? 3.75 : 2.25}
			stroke-linejoin="round"
			stroke-linecap="round"
			opacity={s.emphasis ? 1 : 0.65}
			class="mtc-line"
		/>
		{#if s.values.length}
			<circle cx={X(n - 1)} cy={Y(s.values[s.values.length - 1])} r={s.emphasis ? 4 : 2.75} fill={s.color} />
			{#if s.emphasis}
				<circle cx={X(n - 1)} cy={Y(s.values[s.values.length - 1])} r="7" fill={s.color} opacity="0.18" />
			{/if}
		{/if}
	{/each}

	<!-- hover crosshair + per-series focus dots -->
	{#if hoverI !== null}
		<line x1={hoverX} y1={pT} x2={hoverX} y2={H - pB} stroke="var(--color-text-3)" stroke-width="1" stroke-dasharray="3 3" opacity="0.45" />
		{#each hoverRows as r (r.label)}
			<circle cx={hoverX} cy={Y(r.value)} r={r.emphasis ? 4 : 3} fill={r.color} stroke="var(--color-surface-1, #fff)" stroke-width="1.5" />
		{/each}
	{/if}

	<!-- tooltip: date header + one colour-dotted row per series -->
	{#if hoverI !== null && hoverRows.length}
		<g style="pointer-events:none">
			<rect x={ttX} y={ttY} width={ttW} height={ttH} rx="7"
				fill="var(--color-surface-1, #fff)" stroke="var(--color-border, #e5e7eb)" stroke-width="1"
				style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.12))" />
			{#if hoverDate}
				<text x={ttX + 9} y={ttY + 15} font-size="10" font-weight="700" fill="var(--color-text-3)">{hoverDate}</text>
			{/if}
			{#each hoverRows as r, ri (r.label)}
				{@const ry = ttY + (hoverDate ? 15 : 0) + 15 + ri * 15}
				<circle cx={ttX + 12} cy={ry - 3.5} r="3.5" fill={r.color} />
				<text x={ttX + 21} y={ry} font-size="10.5" font-weight={r.emphasis ? '800' : '500'} fill="var(--color-text-2)">{r.label}</text>
				{#if r.count !== undefined}
					<text x={ttX + ttW - 9 - ttValW} y={ry} text-anchor="end" font-size="10" font-weight="500" fill="var(--color-text-3)">· {r.count.toLocaleString('tr-TR')}</text>
				{/if}
				<text x={ttX + ttW - 9} y={ry} text-anchor="end" font-size="10.5" font-weight="800" fill="var(--color-text-1)">{r.value.toFixed(1)}</text>
			{/each}
		</g>
	{/if}
</svg>

<style>
	.mtc-line {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: mtc-draw 0.9s ease-out forwards;
	}
	@keyframes mtc-draw { to { stroke-dashoffset: 0; } }
	@media (prefers-reduced-motion: reduce) {
		.mtc-line { animation: none; stroke-dashoffset: 0; }
	}
</style>

<!-- Legend -->
<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
	{#each series as s (s.key)}
		<span class="inline-flex items-center gap-1.5 text-[11.5px] {s.emphasis ? 'font-bold text-text-1' : 'text-text-2'}">
			<i class="rounded-full {s.emphasis ? 'h-[4px] w-4' : 'h-[3px] w-3.5'}" style="background:{s.color}"></i>{s.label}
			{#if s.count !== undefined}<span class="font-normal text-text-3">· {s.count.toLocaleString('tr-TR')}</span>{/if}
		</span>
	{/each}
</div>
