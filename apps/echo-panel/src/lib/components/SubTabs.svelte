<!--
  SubTabs — a reusable pill-group sub-tab bar (segmented control).

  Extracted from the platform detail page's inline bar so the platform OVERVIEW
  (index) and the platform DETAIL pages share one implementation. The active pill
  is raised (bg-surface-1 + shadow) and can be tinted with an optional brand color.
-->
<script lang="ts">
	interface Props {
		/** tab labels; the active value is the lowercased label */
		tabs: string[];
		/** bound active key (lowercased label) */
		active: string;
		/** optional brand color for the active tab's text (e.g. platform color) */
		color?: string;
		onselect?: (key: string) => void;
	}

	let { tabs, active = $bindable(), color, onselect }: Props = $props();

	function pick(key: string) {
		active = key;
		onselect?.(key);
	}
</script>

<div class="inline-flex rounded-[11px] bg-surface-2 p-1">
	{#each tabs as t (t)}
		{@const key = t.toLowerCase()}
		<button
			onclick={() => pick(key)}
			class="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors
				{active === key ? 'bg-surface-1 shadow-card' : 'text-text-2'}"
			style={active === key && color ? `color:${color}` : ''}
		>
			{t}
		</button>
	{/each}
</div>
