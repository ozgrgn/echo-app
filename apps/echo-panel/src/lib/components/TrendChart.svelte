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
		 * Monthly form 'YYYY-MM' or, when `daily`, daily form 'YYYY-MM-DD'.
		 */
		periods?: string[];
		/** Periods are daily ('YYYY-MM-DD') → tick labels read 'DD/MM' not 'MM/YY'. */
		daily?: boolean;
		/** What the plotted value is called in the tooltip (default 'GPI'). */
		valueLabel?: string;
		/** Optional muted tooltip line per actual point (e.g. '12 mention'). */
		pointNotes?: (string | null)[];
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
		periods = [],
		daily = false,
		valueLabel = 'GPI',
		pointNotes = []
	}: Props = $props();

	const W = 740;
	const H = $derived(height);
	const pL = 38, pR = 20, pT = 16, pB = 28;

	// Projection shares the last actual point, so total x-slots = actual + (proj-1).
	const n = $derived(actual.length + Math.max(0, projection.length - 1));
	const ticks = $derived(yticks ?? [ymin, (ymin + ymax) / 2, ymax]);

	const X = (i: number) => pL + (i * (W - pL - pR)) / (n - 1);
	const Y = (v: number) => pT + ((ymax - v) / (ymax - ymin)) * (H - pT - pB);

	// ────────────────────────────────────────────────────────────────────────
	// CONTRIBUTION POINT #1 — smoothPath()
	//
	// Turn a list of [x,y] pixel points into an SVG path string. Right now the
	// chart uses hard `L` segments (straight lines with sharp corners). We want a
	// SMOOTH curve that still passes exactly through every data point (the GPI
	// values are sacred — 82.8 must sit on its dot, not near it).
	//
	// The classic technique is a Catmull-Rom spline converted to cubic Béziers.
	// For each segment between P[i] and P[i+1], the two control points are
	// derived from the neighbours P[i-1] and P[i+2]:
	//
	//   cp1 = P[i]   + (P[i+1] - P[i-1]) / 6 * tension
	//   cp2 = P[i+1] - (P[i+2] - P[i])   / 6 * tension
	//
	// then emit `C cp1x cp1y cp2x cp2y P[i+1]x P[i+1]y`.
	// Clamp the neighbour lookups at the ends (i-1 → i, i+2 → i+1).
	//
	// TODO(you): implement this. Return `M x0 y0` followed by one `C ...` per
	// segment. If pts.length < 3, just fall back to straight `L` lines (a spline
	// needs neighbours to bend). `tension` ~ 1 is a natural default; lower = tighter.
	// ────────────────────────────────────────────────────────────────────────
	function smoothPath(pts: readonly (readonly [number, number])[], tension = 1): string {
		// A spline needs neighbours to bend — fall back to straight lines for <3 pts.
		if (pts.length < 3) {
			return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
		}
		const f = (n: number) => n.toFixed(1);
		let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
		for (let i = 0; i < pts.length - 1; i++) {
			// Clamp neighbour lookups at the ends (i-1 → i, i+2 → i+1).
			const p0 = pts[i === 0 ? 0 : i - 1];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
			// Catmull-Rom → cubic Bézier control points.
			const cp1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
			const cp1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
			const cp2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
			const cp2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
			d += ` C${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(p2[0])} ${f(p2[1])}`;
		}
		return d;
	}

	const actualPts = $derived(actual.map((v, i) => [X(i), Y(v)] as const));
	const actualLine = $derived(smoothPath(actualPts));
	const areaPath = $derived(
		`${actualLine} L ${X(actual.length - 1).toFixed(1)} ${Y(ymin)} L ${pL} ${Y(ymin)} Z`
	);
	const projPts = $derived(
		projection.map((v, i) => [X(actual.length - 1 + i), Y(v)] as const)
	);
	const projLine = $derived(smoothPath(projPts));
	const lastPt = $derived(actualPts[actualPts.length - 1]);

	// ── Hover state ──────────────────────────────────────────────────────────
	// hoverI = index of the nearest actual point under the cursor (null = none).
	// We convert the mouse's client X into the SVG's 0..W coordinate space, then
	// snap to the closest data index. Tooltip + crosshair render from this.
	let svgEl: SVGSVGElement | null = $state(null);
	let hoverI = $state<number | null>(null);

	function onMove(e: PointerEvent) {
		if (!svgEl || actual.length === 0) return;
		const rect = svgEl.getBoundingClientRect();
		// Map cursor px → SVG user units (viewBox is 0..W wide regardless of render size).
		const svgX = ((e.clientX - rect.left) / rect.width) * W;
		// Snap to nearest actual index by comparing against each point's X().
		let best = 0, bestD = Infinity;
		for (let i = 0; i < actual.length; i++) {
			const d = Math.abs(X(i) - svgX);
			if (d < bestD) { bestD = d; best = i; }
		}
		hoverI = best;
	}
	function onLeave() { hoverI = null; }

	// Geometry for the hovered point (crosshair + tooltip anchor).
	const hoverPt = $derived(hoverI === null ? null : ([X(hoverI), Y(actual[hoverI])] as const));

	// x labels: ~5 evenly spaced period ticks over the actual region only (projection
	// slots have no period). Always include the newest period. Monthly → 'MM/YY';
	// daily → 'DD/MM' (a short window's day-resolution axis).
	const xticks = $derived.by(() => {
		if (periods.length === 0) return [];
		const last = periods.length - 1;
		const step = Math.max(1, Math.ceil(periods.length / 5));
		const idxs: number[] = [];
		for (let i = 0; i < periods.length; i += step) idxs.push(i);
		if (idxs[idxs.length - 1] !== last) idxs.push(last);
		return idxs.map((i) => {
			const [y, m, d] = periods[i].split('-');
			return { x: X(i), label: daily ? `${d}/${m}` : `${m}/${y.slice(2)}` };
		});
	});

	// Format one period key ('YYYY-MM' | 'YYYY-MM-DD') for the tooltip header.
	function fmtPeriod(p: string): string {
		const [y, m, d] = p.split('-');
		return daily ? `${d}.${m}.${y}` : `${m}/${y}`;
	}

	// ────────────────────────────────────────────────────────────────────────
	// CONTRIBUTION POINT #2 — tooltipLines()
	//
	// Given the hovered index, return the lines of text shown in the tooltip.
	// You decide WHAT the user sees on hover — this is a product/UX call, not
	// mechanical. Data available to you at index i:
	//   • actual[i]              → the GPI value at that point
	//   • periods[i]             → the period key (may be undefined if no periods)
	//   • target                 → the goal line value (may be undefined)
	//   • actual[i] - actual[i-1]→ movement vs. previous point (if i > 0)
	//
	// Ideas to consider (pick what tells the best story — you don't need all):
	//   - a header line with the formatted date (use fmtPeriod(periods[i]))
	//   - the GPI value, prominently
	//   - delta vs previous period ("+1.2" / "−0.8"), maybe with an arrow
	//   - distance to target ("Hedefe +12.8" when target is defined)
	//
	// Return an array of { text, emphasis? }. `emphasis: true` renders bold/brand.
	// The renderer sizes the box from the longest line, so keep lines short.
	// ────────────────────────────────────────────────────────────────────────
	/**
	 * Format a plotted value for display.
	 *
	 * Scores arrive as raw floats (a GPI is 81.551843782) and were being printed verbatim,
	 * so the end-of-line label and the tooltip read "GPI 81.551843782" next to a KPI tile
	 * showing "81.6". But this chart is generic — it also plots mention counts — so a blanket
	 * toFixed(1) would render "1442.0 mention". Round fractions to one decimal, leave whole
	 * numbers whole.
	 */
	function fmtValue(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	function tooltipLines(i: number): { text: string; emphasis?: boolean }[] {
		const lines: { text: string; emphasis?: boolean }[] = [];
		// Date header first (muted), then the value (emphasized), then the optional
		// per-point note (e.g. mention volume) so hover answers "kaç mention'dan?".
		if (periods[i]) lines.push({ text: fmtPeriod(periods[i]) });
		lines.push({ text: `${valueLabel} ${fmtValue(actual[i])}`, emphasis: true });
		if (pointNotes[i]) lines.push({ text: pointNotes[i] as string });
		return lines;
	}

	const hoverLines = $derived(hoverI === null ? [] : tooltipLines(hoverI));
	// Tooltip box geometry: width from the longest line (~6px/char + padding),
	// flipped to the left of the cursor when it would overflow the right edge.
	const ttW = $derived(Math.max(64, ...hoverLines.map((l) => l.text.length * 6.2 + 16)));
	const ttH = $derived(hoverLines.length * 15 + 10);
	const ttX = $derived.by(() => {
		if (!hoverPt) return 0;
		const raw = hoverPt[0] + 10;
		return raw + ttW > W - pR ? hoverPt[0] - ttW - 10 : raw;
	});
	const ttY = $derived(hoverPt ? Math.max(pT, hoverPt[1] - ttH - 8) : 0);
</script>

<svg
	bind:this={svgEl}
	viewBox="0 0 {W} {H}"
	preserveAspectRatio="xMidYMid meet"
	style="width:100%;height:{height}px;max-height:{height}px;display:block"
	role="img"
	onpointermove={onMove}
	onpointerleave={onLeave}
>
	<defs>
		<!-- Richer vertical gradient for the area fill (strong near the line, fades down). -->
		<linearGradient id="tc-area" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={color} stop-opacity="0.28" />
			<stop offset="55%" stop-color={color} stop-opacity="0.08" />
			<stop offset="100%" stop-color={color} stop-opacity="0" />
		</linearGradient>
	</defs>

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

	<!-- actual area + line (line draws itself on mount via stroke-dashoffset) -->
	<path d={areaPath} fill="url(#tc-area)" class="tc-area" />
	<path d={actualLine} pathLength="1" fill="none" stroke={color} stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" class="tc-line" />

	<!-- projection (dashed amber) -->
	{#if projPts.length}
		<path d={projLine} fill="none" stroke="var(--color-warning)" stroke-width="2.8" stroke-dasharray="7 5" stroke-linecap="round" />
	{/if}

	<!-- hover crosshair + focus dot -->
	{#if hoverPt}
		<line x1={hoverPt[0]} y1={pT} x2={hoverPt[0]} y2={H - pB} stroke={color} stroke-width="1" stroke-dasharray="3 3" opacity="0.5" />
		<circle cx={hoverPt[0]} cy={hoverPt[1]} r="7" fill={color} opacity="0.15" />
		<circle cx={hoverPt[0]} cy={hoverPt[1]} r="4" fill={color} stroke="var(--color-surface-1, #fff)" stroke-width="2" />
	{/if}

	<!-- end dot + value (hidden while hovering, so it doesn't fight the focus dot) -->
	{#if lastPt && hoverI === null}
		<circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill={color} stroke="#fff" stroke-width="2" />
		<circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill="none" stroke={color} stroke-width="2" class="tc-pulse" />
		<text x={lastPt[0]} y={lastPt[1] - 11} text-anchor="middle" font-size="11.5" font-weight="800" fill={color}>
			{fmtValue(actual[actual.length - 1])}
		</text>
	{/if}

	<!-- tooltip -->
	{#if hoverPt && hoverLines.length}
		<g style="pointer-events:none">
			<rect x={ttX} y={ttY} width={ttW} height={ttH} rx="7"
				fill="var(--color-surface-1, #fff)" stroke="var(--color-border, #e5e7eb)" stroke-width="1"
				style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.12))" />
			{#each hoverLines as ln, li (li)}
				<text x={ttX + 8} y={ttY + 16 + li * 15}
					font-size={ln.emphasis ? '12' : '10.5'}
					font-weight={ln.emphasis ? '800' : '500'}
					fill={ln.emphasis ? color : 'var(--color-text-2)'}>{ln.text}</text>
			{/each}
		</g>
	{/if}
</svg>

<style>
	/* Line draws itself left→right on mount. pathLength=1 normalizes any path
	   length to 1 unit so the same keyframes work regardless of curve length. */
	.tc-line {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: tc-draw 0.9s ease-out forwards;
	}
	.tc-area {
		opacity: 0;
		animation: tc-fade 0.6s ease-out 0.5s forwards;
	}
	.tc-pulse {
		transform-box: fill-box;
		transform-origin: center;
		animation: tc-ping 2s ease-out infinite;
	}
	@keyframes tc-draw { to { stroke-dashoffset: 0; } }
	@keyframes tc-fade { to { opacity: 1; } }
	@keyframes tc-ping {
		0%   { transform: scale(1);   opacity: 0.6; }
		70%  { transform: scale(2.6); opacity: 0;   }
		100% { transform: scale(2.6); opacity: 0;   }
	}
	@media (prefers-reduced-motion: reduce) {
		.tc-line, .tc-area, .tc-pulse { animation: none; opacity: 1; stroke-dashoffset: 0; }
	}
</style>
