<!--
  MetricInfo — the "?" affordance next to a metric: opens a small popover explaining
  what the number is and how it's computed. Content comes from the backend metric
  registry (GET /v1/meta/metrics via the /api/os/data proxy), keyed by the shared
  `reviews.*` metricPath id — the SAME entries the assistant's explainEchoMetric
  tool will narrate from in Faz 1, so popover and assistant can never disagree.
-->
<script lang="ts" module>
	import type { MetricMeta } from '@talkwo/echo-ui';

	// One registry fetch per page load, shared by every MetricInfo instance —
	// the registry is static per deploy (backend sends max-age=86400 anyway).
	let cache: Promise<Map<string, MetricMeta>> | null = null;
	function loadRegistry(): Promise<Map<string, MetricMeta>> {
		cache ??= fetch('/api/os/data?resource=metricMeta')
			.then((r) => {
				if (!r.ok) throw new Error(`metricMeta failed: ${r.status}`);
				return r.json();
			})
			.then((d) => new Map((d.metrics as MetricMeta[]).map((m) => [m.id, m])))
			.catch((e) => {
				cache = null; // drop the rejected promise so a later open can retry
				throw e;
			});
		return cache;
	}
</script>

<script lang="ts">
	import { CircleHelp } from '@lucide/svelte';

	interface Props {
		/** `reviews.*` metricPath id — must exist in the backend registry. */
		metricId: string;
		/** Which icon edge the popover hangs from (avoid viewport overflow). */
		align?: 'left' | 'right';
	}
	let { metricId, align = 'right' }: Props = $props();

	let open = $state(false);
	let meta = $state<MetricMeta | null>(null);
	let failed = $state(false);
	let root = $state<HTMLElement | null>(null);

	// StatTile can render as a whole-tile <a>; the "?" lives inside it, so the
	// click must not bubble into navigation.
	async function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		open = !open;
		if (open && !meta) {
			failed = false;
			try {
				meta = (await loadRegistry()).get(metricId) ?? null;
				failed = meta === null;
			} catch {
				failed = true;
			}
		}
	}

	// Close on outside pointer-down / Escape. Listeners are per-instance but only
	// act while this popover is open, so the cost is negligible.
	function onDocPointerDown(e: PointerEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
	function onDocKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:document onpointerdown={onDocPointerDown} onkeydown={onDocKeydown} />

<span class="relative inline-flex" bind:this={root}>
	<button
		type="button"
		class="rounded-full p-0.5 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
		aria-label="Nasıl hesaplanır?"
		title="Nasıl hesaplanır?"
		aria-expanded={open}
		onclick={toggle}
	>
		<CircleHelp size={13} strokeWidth={2} />
	</button>

	{#if open}
		<!-- Swallow clicks so text-selection inside the popover can't trigger the
		     surrounding tile link's navigation. -->
		<div
			role="dialog"
			aria-label="Metrik açıklaması"
			tabindex="-1"
			onclick={(e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();
			}}
			onkeydown={(e: KeyboardEvent) => {
				if (e.key !== 'Escape') e.stopPropagation();
			}}
			class="absolute top-full z-50 mt-1.5 w-[290px] cursor-default rounded-xl border border-border bg-surface-1 p-3.5 text-left shadow-xl {align ===
			'right'
				? 'right-0'
				: 'left-0'}"
		>
			{#if meta}
				<div class="mb-1 text-[12px] font-bold text-text-1">{meta.label}</div>
				<p class="text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-text-2">
					{meta.shortHelp}
				</p>
				{#if meta.caveats.length > 0}
					<ul class="mt-2 space-y-1 border-t border-border pt-2">
						{#each meta.caveats as caveat (caveat)}
							<li
								class="flex gap-1.5 text-[10.5px] font-normal normal-case leading-snug tracking-normal text-text-3"
							>
								<span aria-hidden="true">·</span><span>{caveat}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if failed}
				<p class="text-[11.5px] font-normal normal-case tracking-normal text-text-3">
					Açıklama şu an yüklenemedi.
				</p>
			{:else}
				<p class="text-[11.5px] font-normal normal-case tracking-normal text-text-3">Yükleniyor…</p>
			{/if}
		</div>
	{/if}
</span>
