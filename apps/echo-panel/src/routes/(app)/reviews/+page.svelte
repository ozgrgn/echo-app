<script lang="ts">
	import {
		CATEGORIES,
		PLATFORM_REGISTRY,
		type Review,
		type Sentiment,
		type CategoryKey
	} from '@talkwo/echo-core';
	import { page } from '$app/state';
	import ReviewDetailModal from '$lib/components/ReviewDetailModal.svelte';

	let { data } = $props();

	// ── Filters ──
	type PlatformFilter = string; // open-ended (PLATFORM_REGISTRY keys + 'all')
	type SentimentFilter = Sentiment | 'all';
	type CategoryFilter = CategoryKey | 'all';
	type LangFilter = string | 'all';
	type ResponseFilter = 'all' | 'with' | 'without';

	// Read initial filter values from URL params (?response=without etc.)
	// so Dashboard KPI clicks can deep-link into a pre-filtered view.
	const urlResponse = page.url.searchParams.get('response');
	const initialResponse: ResponseFilter =
		urlResponse === 'with' || urlResponse === 'without' ? urlResponse : 'all';

	let platformFilter = $state<PlatformFilter>('all');
	let sentimentFilter = $state<SentimentFilter>('all');
	let categoryFilter = $state<CategoryFilter>('all');
	let langFilter = $state<LangFilter>('all');
	let responseFilter = $state<ResponseFilter>(initialResponse);
	let visibleCount = $state(8); // Phase 1 "load more" pagination

	function resetFilters() {
		platformFilter = 'all';
		sentimentFilter = 'all';
		categoryFilter = 'all';
		langFilter = 'all';
		responseFilter = 'all';
		visibleCount = 8;
	}

	const filtered = $derived.by(() => {
		return data.reviews.filter((r) => {
			if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
			if (langFilter !== 'all' && r.lang !== langFilter) return false;
			if (responseFilter === 'with' && !r.ownerResponse) return false;
			if (responseFilter === 'without' && r.ownerResponse) return false;
			if (categoryFilter !== 'all' || sentimentFilter !== 'all') {
				const matches = r.sentiments.some((s) => {
					if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
					if (sentimentFilter !== 'all' && s.sentiment !== sentimentFilter) return false;
					return true;
				});
				if (!matches) return false;
			}
			return true;
		});
	});

	const visible = $derived(filtered.slice(0, visibleCount));
	const hasMore = $derived(filtered.length > visible.length);

	// ── Aggregate sentiment counts on filter set (for filter chip badges) ──
	const counts = $derived({
		all: filtered.length,
		positive: filtered.filter((r) => r.sentiments.some((s) => s.sentiment === 'positive'))
			.length,
		negative: filtered.filter((r) => r.sentiments.some((s) => s.sentiment === 'negative'))
			.length,
		mixed: filtered.filter((r) => r.sentiments.some((s) => s.sentiment === 'mixed')).length
	});

	// Reset visible count when filters change
	$effect(() => {
		// Trigger re-read of filter state
		void platformFilter;
		void sentimentFilter;
		void categoryFilter;
		void langFilter;
		void responseFilter;
		visibleCount = 8;
	});

	// ── Modal ──
	let modalOpen = $state(false);
	let modalReview = $state<Review | null>(null);
	function openModal(r: Review) {
		modalReview = r;
		modalOpen = true;
	}

	// ── Helpers ──
	function stars(rating: number): string {
		// Clamp to 0..5 — some platforms send out-of-range or missing ratings
		// (e.g. HolidayCheck's 1-6 scale, or null), which would make repeat() negative.
		const filled = Math.max(0, Math.min(5, Math.round(rating || 0)));
		return '★'.repeat(filled) + '☆'.repeat(5 - filled);
	}
	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleDateString('tr-TR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
	function langFlag(lang: string): string {
		const map: Record<string, string> = { tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ru: '🇷🇺' };
		return map[lang] ?? '🌐';
	}
	function langLabel(lang: string): string {
		const map: Record<string, string> = {
			tr: 'Türkçe',
			en: 'English',
			de: 'Deutsch',
			ru: 'Русский'
		};
		return map[lang] ?? lang.toUpperCase();
	}
	function platformLabel(key: string): string {
		return PLATFORM_REGISTRY[key]?.label ?? key;
	}
	function platformIcon(key: string): string {
		return PLATFORM_REGISTRY[key]?.icon ?? '🌐';
	}

	function hoursSince(iso: string): number {
		return Math.max(0, (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
	}
	function fmtRelativeHours(hours: number): string {
		if (hours < 1) return 'birkaç dakika';
		if (hours < 24) return `${Math.round(hours)} saat`;
		const days = Math.round(hours / 24);
		if (days < 30) return `${days} gün`;
		const months = Math.round(days / 30);
		return `${months} ay`;
	}
	function responseSpeedBadge(hours: number): { icon: string; cls: string } {
		if (hours <= 6) return { icon: '⚡', cls: 'bg-success-light text-success' };
		if (hours <= 24) return { icon: '✓', cls: 'bg-success-light text-success' };
		if (hours <= 72) return { icon: '·', cls: 'bg-surface-2 text-text-2' };
		return { icon: '🐢', cls: 'bg-warning-light text-warning' };
	}

	function topSentimentBadge(r: Review): { label: string; cls: string } {
		const counts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
		for (const s of r.sentiments) counts[s.sentiment] = (counts[s.sentiment] ?? 0) + 1;
		const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
		if (top === 'positive') return { label: 'Olumlu', cls: 'bg-success-light text-success' };
		if (top === 'negative') return { label: 'Olumsuz', cls: 'bg-danger-light text-danger' };
		if (top === 'mixed') return { label: 'Karışık', cls: 'bg-warning-light text-warning' };
		return { label: 'Nötr', cls: 'bg-surface-2 text-text-2' };
	}

	// Tenant's subscribed platforms — from the auth context's subscription.
	// Mock tenant has ['tripadvisor'] effectively (only shipped platform).
	const subscribedPlatforms = $derived(['tripadvisor']); // Phase 2: sub.features.platforms

	// 10 categories list for the dropdown
	const categoryList = Object.keys(CATEGORIES) as CategoryKey[];
</script>

<div class="space-y-4">
	<!-- ── Sticky filter bar ─────────────────────────────────────────── -->
	<div class="sticky top-[68px] z-10 bg-bg/95 backdrop-blur-sm -mx-4 px-4 py-3 border-b border-border">
		<div class="space-y-3">
			<!-- Row 1: platform + sentiment chips -->
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<span class="text-xs text-text-3 uppercase tracking-wider font-semibold mr-1">
					Platform:
				</span>
				{#each subscribedPlatforms as p (p)}
					{@const isActive = platformFilter === p}
					<button
						onclick={() => (platformFilter = isActive ? 'all' : p)}
						class={[
							'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
							isActive
								? 'bg-brand text-white border-brand'
								: 'bg-surface-1 text-text-2 border-border hover:bg-surface-2'
						]}
					>
						<span>{platformIcon(p)}</span>
						<span>{platformLabel(p)}</span>
					</button>
				{/each}

				<span class="text-xs text-text-3 uppercase tracking-wider font-semibold ml-3 mr-1">
					Duygu:
				</span>
				{#each [{ v: 'all', l: 'Hepsi', c: 'all' }, { v: 'positive', l: 'Olumlu', c: 'positive' }, { v: 'negative', l: 'Olumsuz', c: 'negative' }, { v: 'mixed', l: 'Karışık', c: 'mixed' }] as opt (opt.v)}
					{@const isActive = sentimentFilter === opt.v}
					{@const count = counts[opt.c as keyof typeof counts]}
					<button
						onclick={() => (sentimentFilter = opt.v as SentimentFilter)}
						class={[
							'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
							isActive
								? opt.v === 'positive'
									? 'bg-success-light text-success border-success'
									: opt.v === 'negative'
										? 'bg-danger-light text-danger border-danger'
										: opt.v === 'mixed'
											? 'bg-warning-light text-warning border-warning'
											: 'bg-brand text-white border-brand'
								: 'bg-surface-1 text-text-2 border-border hover:bg-surface-2'
						]}
					>
						<span>{opt.l}</span>
						<span class="text-[10px] opacity-70 font-mono">{count}</span>
					</button>
				{/each}
			</div>

			<!-- Row 2: response status chips + dropdowns -->
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<span class="text-xs text-text-3 uppercase tracking-wider font-semibold mr-1">
					Cevap:
				</span>
				{#each [{ v: 'all', l: 'Hepsi', icon: '' }, { v: 'with', l: 'Cevaplandı', icon: '↳' }, { v: 'without', l: 'Bekliyor', icon: '⏳' }] as opt (opt.v)}
					{@const isActive = responseFilter === opt.v}
					<button
						onclick={() => (responseFilter = opt.v as ResponseFilter)}
						class={[
							'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
							isActive
								? opt.v === 'with'
									? 'bg-success-light text-success border-success'
									: opt.v === 'without'
										? 'bg-warning-light text-warning border-warning'
										: 'bg-brand text-white border-brand'
								: 'bg-surface-1 text-text-2 border-border hover:bg-surface-2'
						]}
					>
						{#if opt.icon}<span>{opt.icon}</span>{/if}
						<span>{opt.l}</span>
					</button>
				{/each}

				<span class="text-xs text-text-3 uppercase tracking-wider font-semibold ml-3 mr-1">
					Kategori:
				</span>
				<select
					bind:value={categoryFilter}
					class="rounded-md border border-border bg-surface-1 px-2 py-1 text-xs focus:border-brand focus:outline-none"
				>
					<option value="all">Tümü</option>
					{#each categoryList as cat (cat)}
						<option value={cat}>{CATEGORIES[cat].label}</option>
					{/each}
				</select>

				<span class="text-xs text-text-3 uppercase tracking-wider font-semibold ml-2 mr-1">
					Dil:
				</span>
				<select
					bind:value={langFilter}
					class="rounded-md border border-border bg-surface-1 px-2 py-1 text-xs focus:border-brand focus:outline-none"
				>
					<option value="all">Tümü</option>
					{#each data.availableLanguages as l (l)}
						<option value={l}>{langFlag(l)} {langLabel(l)}</option>
					{/each}
				</select>

				<button
					onclick={resetFilters}
					class="text-xs text-text-3 hover:text-text-1 ml-auto"
				>
					Filtreleri temizle
				</button>
			</div>
		</div>
	</div>

	<!-- ── Results summary ────────────────────────────────────────────── -->
	<div class="text-xs text-text-3 flex items-center justify-between">
		<span>
			<span class="font-mono text-text-1">{filtered.length}</span> yorum bulundu
			{#if filtered.length < data.reviews.length}
				· <span>{data.reviews.length - filtered.length}</span> filtrelendi
			{/if}
		</span>
		<span class="text-text-3">
			Yalnızca <strong>kendi otelinizin</strong> yorumları görüntülenir (rakip yorumları
			görüntülenemez — ToS/legal).
		</span>
	</div>

	<!-- ── Reviews list ──────────────────────────────────────────────── -->
	{#if visible.length === 0}
		<div class="bg-surface-1 border border-border rounded-lg p-12 text-center">
			<div class="text-4xl mb-3">🔍</div>
			<div class="text-base font-medium text-text-1 mb-1">Sonuç bulunamadı</div>
			<div class="text-sm text-text-3 mb-4">
				Mevcut filtrelere uyan yorum yok. Filtreleri gevşetmeyi deneyin.
			</div>
			<button onclick={resetFilters} class="text-sm text-brand hover:underline">
				Filtreleri temizle →
			</button>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each visible as review (review.id)}
				{@const badge = topSentimentBadge(review)}
				<li>
					<button
						onclick={() => openModal(review)}
						class="w-full text-left bg-surface-1 border border-border rounded-lg p-4 hover:shadow-md hover:border-brand/30 transition-all"
					>
						<!-- Header -->
						<div class="flex items-center gap-2 mb-2 flex-wrap text-xs">
							<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 text-text-2">
								<span>{platformIcon(review.platform)}</span>
								<span class="font-medium">{platformLabel(review.platform)}</span>
							</span>
							<span class="text-warning">{stars(review.rating)}</span>
							<span class="text-text-3">·</span>
							<span class="text-text-2">{fmtDate(review.publishedDate)}</span>
							<span class="text-text-3">·</span>
							<span class="text-text-2 inline-flex items-center gap-1">
								<span>{langFlag(review.lang)}</span>
								<span class="uppercase tracking-wider">{review.lang}</span>
							</span>
							<span class={['ml-auto px-2 py-0.5 rounded-full font-medium', badge.cls]}>
								{badge.label}
							</span>
						</div>

						<!-- Title + text -->
						<h3 class="text-sm font-semibold text-text-1 mb-1">{review.title}</h3>
						<p class="text-sm text-text-2 line-clamp-2 mb-2">{review.text}</p>

						<!-- Sentiment tags + response indicator -->
						<div class="flex items-center gap-2 flex-wrap text-xs">
							{#each review.sentiments.slice(0, 4) as s, i (s.category + '-' + (s.granular_key ?? s.parent_key ?? s.subcategory ?? i))}
								{@const meta = CATEGORIES[s.category]}
								{@const cls =
									s.sentiment === 'positive'
										? 'bg-success-light text-success'
										: s.sentiment === 'negative'
											? 'bg-danger-light text-danger'
											: s.sentiment === 'mixed'
												? 'bg-warning-light text-warning'
												: 'bg-surface-2 text-text-2'}
								<span class={['inline-block px-1.5 py-0.5 rounded font-medium', cls]}>
									{meta.label}
								</span>
							{/each}
							{#if review.sentiments.length > 4}
								<span class="text-text-3">+{review.sentiments.length - 4} daha</span>
							{/if}
							{#if review.ownerResponse}
								{@const speed = responseSpeedBadge(review.ownerResponse.responseTimeHours)}
								<span
									class={['ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium', speed.cls]}
									title="Cevap verildi · {fmtRelativeHours(review.ownerResponse.responseTimeHours)} sonra"
								>
									{speed.icon} {fmtRelativeHours(review.ownerResponse.responseTimeHours)}
								</span>
							{:else}
								{@const waiting = hoursSince(review.publishedDate)}
								<span
									class="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium bg-warning-light/60 text-warning"
									title="Cevap bekleniyor · {fmtRelativeHours(waiting)}"
								>
									⏳ {fmtRelativeHours(waiting)} bekliyor
								</span>
							{/if}
						</div>
					</button>
				</li>
			{/each}
		</ul>

		{#if hasMore}
			<div class="text-center pt-2">
				<button
					onclick={() => (visibleCount += 8)}
					class="px-5 py-2 rounded-md bg-surface-1 border border-border text-sm font-medium text-text-2 hover:bg-surface-2 transition-colors"
				>
					Daha fazla yükle ({filtered.length - visible.length} kaldı)
				</button>
			</div>
		{/if}
	{/if}
</div>

<ReviewDetailModal
	review={modalReview}
	open={modalOpen}
	onOpenChange={(v) => (modalOpen = v)}
/>
