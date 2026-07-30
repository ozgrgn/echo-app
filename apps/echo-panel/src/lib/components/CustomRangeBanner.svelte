<!--
  CustomRangeBanner — the G12 custom-range header line, shared by every OS lens.

  WHY A COMPONENT. The "… itibarıyla <effectiveDate>" label is MANDATORY, not decoration
  (SERBEST_ARALIK_TASARIM.md): a range whose end falls on a day with no scored row is served
  from the nearest EARLIER row, so an unlabelled card would quietly claim a date it isn't.
  Genel had this banner inline; platform/rakipler/departmanlar needed the same thing. Four
  copies of a mandatory disclosure is how disclosures drift — and this file's neighbour
  osNav.ts exists because exactly that happened to the nav arrays.

  Renders nothing when `range` is null, so a lens can mount it unconditionally.
-->
<script lang="ts">
	import { CalendarRange } from '@lucide/svelte';

	interface Props {
		/** From the bundle (`customRange`) or the departments read; null in fixed-window mode. */
		range: { from: string; to: string; effectiveDate: string } | null;
	}
	let { range }: Props = $props();
</script>

{#if range}
	<div
		class="mb-3.5 flex flex-wrap items-center gap-2 rounded-[14px] border border-brand/25 bg-brand/8 px-4 py-2.5 text-[12.5px] text-text-2"
	>
		<CalendarRange size={15} class="text-brand" strokeWidth={2} />
		<span>
			Özel aralık: <b class="text-text-1">{range.from}</b> →
			<b class="text-text-1">{range.to}</b>
		</span>
		<span class="text-text-3">·</span>
		<span>
			kartlar <b class="text-text-1">{range.effectiveDate}</b> itibarıyla
			{#if range.effectiveDate !== range.to}
				<span class="text-text-3">(seçilen bitişte skorlanmış gün yok — en yakın önceki gün)</span>
			{/if}
		</span>
	</div>
{/if}
