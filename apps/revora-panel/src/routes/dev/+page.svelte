<script lang="ts">
	import { CATEGORIES, CATEGORY_LIST, TOTAL_WEIGHT, gpiZone, bayesianSmooth } from '@revora/review-core';

	// Svelte 5 runes test — interactive slider re-derives the zone + smoothed value
	let rawGpi = $state(78);
	let sampleSize = $state(50);

	const zone = $derived(gpiZone(rawGpi));
	const smoothed = $derived(bayesianSmooth(rawGpi, sampleSize));

	const zoneClass = $derived(
		zone === 'green' ? 'text-success'
		: zone === 'yellow' ? 'text-warning'
		: 'text-danger'
	);
</script>

<main class="min-h-screen bg-bg p-8">
	<div class="max-w-3xl mx-auto space-y-8">
		<header>
			<h1 class="text-3xl font-extrabold text-brand">Revora Panel</h1>
			<p class="text-text-2 mt-2">Phase 0 — scaffold sanity check</p>
		</header>

		<!-- Test 1: Tailwind + tokens -->
		<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
			<h2 class="text-lg font-semibold mb-4">1. Tailwind 4 + design tokens</h2>
			<div class="flex gap-2 flex-wrap">
				<span class="px-3 py-1 rounded-md bg-success text-white text-sm">Success</span>
				<span class="px-3 py-1 rounded-md bg-warning text-white text-sm">Warning</span>
				<span class="px-3 py-1 rounded-md bg-danger text-white text-sm">Danger</span>
				<span class="px-3 py-1 rounded-md bg-brand text-white text-sm">Brand</span>
				<span class="px-3 py-1 rounded-md bg-surface-2 text-text-1 text-sm">Surface 2</span>
			</div>
		</section>

		<!-- Test 2: @revora/review-core import -->
		<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
			<h2 class="text-lg font-semibold mb-4">2. @revora/review-core workspace import</h2>
			<p class="text-sm text-text-2 mb-3">
				{CATEGORY_LIST.length} kategori yüklendi, toplam ağırlık: <span class="font-mono">{TOTAL_WEIGHT.toFixed(2)}</span>
			</p>
			<ul class="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
				{#each CATEGORY_LIST as cat}
					<li class="flex justify-between">
						<span>{cat.label}</span>
						<span class="font-mono text-text-3">×{cat.weight}</span>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Test 3: Svelte 5 runes + derived state -->
		<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
			<h2 class="text-lg font-semibold mb-4">3. Svelte 5 runes — Bayesian smoothing playground</h2>
			<div class="space-y-4">
				<label class="block">
					<span class="text-sm text-text-2">Ham GPI: <span class="font-mono">{rawGpi}</span></span>
					<input type="range" min="0" max="100" bind:value={rawGpi} class="w-full" />
				</label>
				<label class="block">
					<span class="text-sm text-text-2">Yorum sayısı: <span class="font-mono">{sampleSize}</span></span>
					<input type="range" min="0" max="500" bind:value={sampleSize} class="w-full" />
				</label>
				<div class="bg-surface-2 p-4 rounded-md flex justify-around items-center">
					<div class="text-center">
						<div class="text-xs text-text-2">Zon</div>
						<div class="text-2xl font-bold {zoneClass}">{zone}</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-text-2">Smoothed GPI</div>
						<div class="text-2xl font-bold text-text-1">{smoothed.toFixed(1)}</div>
					</div>
				</div>
			</div>
		</section>

		<footer class="text-xs text-text-3 text-center pt-4">
			Tüm testler ✓ ise Phase 0 başarılı — Phase 1'e geç.
		</footer>
	</div>
</main>
