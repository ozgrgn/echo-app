<!--
  PlatformHero — the hero band atop a platform-universe lens (prototype .phero).
  Left: platform logo + name + review count + the platform's NATIVE OTA star. Right:
  the big GPI number for this channel, plus a small reference tile vs the blended GPI.

  REAL: gpi, reviewCount, nativeStar (from the per-platform snapshot; the star is that
  OTA's own scale — Booking /10, HolidayCheck /6, TA/Google /5). Area-rank (#12/89) is
  still not in the backend, so it's omitted rather than faked.
-->
<script lang="ts">
	import { PLATFORM_PALETTE } from '$lib/mock/os';

	interface Props {
		platform: string;
		label: string;
		gpi: number;
		reviewCount: number;
		/** blended 'all' GPI for the reference tile */
		blendedGpi: number;
		/** platform's native OTA star in its own scale (e.g. 4.4) */
		nativeStar?: number;
		/** top of the native scale (5 | 6 | 10) */
		nativeMax?: number;
	}

	let { platform, label, gpi, reviewCount, blendedGpi, nativeStar, nativeMax } = $props();

	// Three-tone palette per platform, copied from the prototype (.phero):
	// soft hero bg / bright logo / deep GPI text. Each universe = that brand's space.
	const pal = $derived(
		PLATFORM_PALETTE[platform as keyof typeof PLATFORM_PALETTE] ?? {
			soft: '#f1f5f9', border: '#e2e8f0', bright: '#64748b', deep: '#475569', onBright: '#fff'
		}
	);
	const vsBlended = $derived(+(gpi - blendedGpi).toFixed(1));
</script>

<div
	class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border p-5"
	style="background:{pal.soft};border-color:{pal.border}"
>
	<span
		class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] text-[17px] font-extrabold"
		style="background:{pal.bright};color:{pal.onBright}"
	>
		{label.slice(0, 1)}
	</span>
	<div class="min-w-0">
		<div class="flex items-center gap-2 text-base font-extrabold text-text-1">
			{label}
			<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style="background:{pal.soft};color:{pal.deep}">canlı veri</span>
		</div>
		<!-- Review count + the platform's NATIVE OTA star (its own scale) — what the guest
		     sees on that site (Booking 7.5/10, HolidayCheck 5.5/6, TA/Google 4.4/5). -->
		<div class="mt-0.5 flex items-center gap-1.5 text-xs text-text-3">
			<span>{reviewCount} yorum</span>
			{#if nativeStar != null && nativeMax != null}
				<span>·</span>
				<span class="inline-flex items-center gap-0.5 font-bold text-text-2">
					<span style="color:#f5a623">★</span>{nativeStar.toFixed(1)}<span class="font-normal text-text-3">/{nativeMax}</span>
				</span>
			{/if}
		</div>
	</div>

	<div class="ml-auto flex items-end gap-3">
		<div class="flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">GPI</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight" style="color:{pal.deep}">{gpi.toFixed(1)}</span>
		</div>
		<div class="flex min-w-[92px] flex-col gap-0.5 rounded-xl border border-border bg-surface-1 px-3 py-2.5">
			<span class="text-[10px] font-bold uppercase tracking-wide text-text-3">Blend (tüm)</span>
			<span class="text-[22px] font-extrabold leading-tight text-text-1">{blendedGpi.toFixed(1)}</span>
			<span class="text-[10px] {vsBlended >= 0 ? 'text-success' : 'text-danger'}">
				{vsBlended >= 0 ? '+' : ''}{vsBlended} fark
			</span>
		</div>
	</div>
</div>
