<!--
  Sparkline — a tiny inline trend line, pure SVG (no chart library, matching the
  project's HTML/CSS-only viz approach). Renders a smooth area + line + end dot
  that auto-scales to its own min/max. Used inside StatTile to give each KPI
  context the way the mockup does.
-->
<script lang="ts">
	interface Props {
		/** Series of numbers, oldest → newest. Needs ≥2 points to draw. */
		data: number[];
		color?: string; // any CSS color / var()
		width?: number;
		height?: number;
		/** Fill the area under the line with a faint wash. */
		fill?: boolean;
	}

	let {
		data,
		color = 'var(--color-brand)',
		width = 120,
		height = 36,
		fill = true
	}: Props = $props();

	const pad = 2; // keep the stroke + end dot from clipping at the edges

	const points = $derived.by(() => {
		if (data.length < 2) return [];
		const min = Math.min(...data);
		const max = Math.max(...data);
		const span = max - min || 1; // avoid /0 when the series is flat
		const stepX = (width - pad * 2) / (data.length - 1);
		return data.map((v, i) => {
			const x = pad + i * stepX;
			// invert Y (SVG origin top-left) and inset by pad
			const y = pad + (1 - (v - min) / span) * (height - pad * 2);
			return { x, y };
		});
	});

	const linePath = $derived(
		points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
	);

	const areaPath = $derived(
		points.length
			? `${linePath} L${points[points.length - 1].x.toFixed(1)},${height - pad} L${points[0].x.toFixed(1)},${height - pad} Z`
			: ''
	);

	const last = $derived(points[points.length - 1]);
	// Unique id so multiple sparklines don't share one gradient def.
	const gradId = $derived(`spark-${Math.round(points.length ? points[0].y * 97 + width : width)}`);
</script>

{#if points.length}
	<svg
		viewBox="0 0 {width} {height}"
		preserveAspectRatio="none"
		style="width:100%;height:{height}px;display:block"
		class="overflow-visible"
		aria-hidden="true"
	>
		{#if fill}
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.18" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>
			<path d={areaPath} fill="url(#{gradId})" />
		{/if}
		<path
			d={linePath}
			fill="none"
			stroke={color}
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
			vector-effect="non-scaling-stroke"
		/>
		{#if last}
			<circle cx={last.x} cy={last.y} r="2.5" fill={color} vector-effect="non-scaling-stroke" />
		{/if}
	</svg>
{/if}
