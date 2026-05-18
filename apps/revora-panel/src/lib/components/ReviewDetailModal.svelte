<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { CATEGORIES, PLATFORM_REGISTRY, type Review, type Sentiment } from '@revora/review-core';

	interface Props {
		review: Review | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { review, open, onOpenChange }: Props = $props();

	// ── Helpers ──
	function platformMeta(key: string) {
		return PLATFORM_REGISTRY[key] ?? { key, label: key, icon: '🌐', status: 'shipped' as const };
	}

	function sentimentClass(s: Sentiment): string {
		switch (s) {
			case 'positive':
				return 'bg-success-light text-success';
			case 'negative':
				return 'bg-danger-light text-danger';
			case 'mixed':
				return 'bg-warning-light text-warning';
			default:
				return 'bg-surface-2 text-text-2';
		}
	}

	function sentimentDot(s: Sentiment): string {
		switch (s) {
			case 'positive':
				return 'bg-success';
			case 'negative':
				return 'bg-danger';
			case 'mixed':
				return 'bg-warning';
			default:
				return 'bg-text-3';
		}
	}

	function subcategoryLabel(subcat: string): string {
		return subcat.replace(/_/g, ' ');
	}

	function stars(rating: number): string {
		return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
	}

	function travelTypeLabel(tt: string): string {
		const map: Record<string, string> = {
			couples: 'Çiftler',
			family: 'Aile',
			solo: 'Tek başına',
			business: 'İş seyahati',
			friends: 'Arkadaşlar'
		};
		return map[tt] ?? tt;
	}

	function langFlag(lang: string): string {
		const map: Record<string, string> = {
			tr: '🇹🇷',
			en: '🇬🇧',
			de: '🇩🇪',
			ru: '🇷🇺',
			fr: '🇫🇷',
			nl: '🇳🇱'
		};
		return map[lang] ?? '🌐';
	}

	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleDateString('tr-TR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	// ── Response timing helpers ──
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

	function responseSpeedBadge(hours: number): { label: string; icon: string; cls: string } {
		if (hours <= 6) return { label: 'Çok Hızlı', icon: '⚡', cls: 'bg-success-light text-success' };
		if (hours <= 24) return { label: 'Hızlı', icon: '✓', cls: 'bg-success-light text-success' };
		if (hours <= 72) return { label: 'Normal', icon: '·', cls: 'bg-surface-2 text-text-2' };
		return { label: 'Yavaş', icon: '🐢', cls: 'bg-warning-light text-warning' };
	}

	let ownerResponseExpanded = $state(false);
	$effect(() => {
		// Reset accordion state when modal opens with a new review
		if (open) ownerResponseExpanded = false;
	});
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-40 bg-text-1/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,640px)] max-h-[90vh] overflow-y-auto bg-surface-1 rounded-xl shadow-xl border border-border p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
		>
			{#if review}
				{@const platform = platformMeta(review.platform)}

				<!-- Header: platform + rating + meta -->
				<div class="flex items-start justify-between gap-4 mb-4">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-3 mb-2 text-sm flex-wrap">
							<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-2 font-medium">
								<span>{platform.icon}</span>
								<span>{platform.label}</span>
							</span>
							<span class="text-warning text-base tracking-tight" title="{review.rating}/5">
								{stars(review.rating)}
							</span>
							<span class="text-text-3">·</span>
							<span class="text-text-2">{fmtDate(review.publishedDate)}</span>
							<span class="text-text-3">·</span>
							<span class="text-text-2">{travelTypeLabel(review.travelType)}</span>
							<span class="ml-auto text-lg" title="Dil: {review.lang}">{langFlag(review.lang)}</span>
						</div>
						<Dialog.Title class="text-xl font-bold text-text-1 leading-tight">
							{review.title}
						</Dialog.Title>
					</div>
					<Dialog.Close
						class="shrink-0 rounded-md p-1.5 text-text-3 hover:bg-surface-2 hover:text-text-1 transition-colors"
						aria-label="Kapat"
					>
						✕
					</Dialog.Close>
				</div>

				<!-- Review body -->
				<div class="text-sm text-text-1 leading-relaxed mb-5 whitespace-pre-wrap">
					{review.text}
				</div>

				<!-- ABSA tags -->
				<section class="mb-5">
					<h3 class="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">
						ABSA Etiketleri ({review.sentiments.length})
					</h3>
					<ul class="space-y-2">
						{#each review.sentiments as item (`${item.category}-${item.subcategory}-${item.excerpt}`)}
							{@const meta = CATEGORIES[item.category]}
							<li
								class="flex items-start gap-3 p-2.5 rounded-md bg-surface-2/50 hover:bg-surface-2 transition-colors"
							>
								<span
									class="w-2 h-2 rounded-full {sentimentDot(item.sentiment)} mt-1.5 shrink-0"
								></span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap mb-1">
										<span class="text-xs font-semibold text-text-2">{meta.label}</span>
										<span class="text-text-3 text-xs">·</span>
										<span class="text-xs text-text-2 capitalize">
											{subcategoryLabel(item.subcategory)}
										</span>
										<span
											class="text-xs px-1.5 py-0.5 rounded {sentimentClass(item.sentiment)} font-medium"
										>
											{item.sentiment}
										</span>
										<span class="text-xs text-text-3 font-mono ml-auto">
											{Math.round(item.intensity * 100)}%
										</span>
									</div>
									<div class="text-xs text-text-2 italic">"{item.excerpt}"</div>
								</div>
							</li>
						{/each}
					</ul>
				</section>

				<!-- Owner response -->
				<section class="mb-5">
					<h3 class="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">
						Otel Cevabı
					</h3>
					{#if review.ownerResponse}
						{@const resp = review.ownerResponse}
						{@const isLangMatch = resp.language === review.lang}
						{@const speedBadge = responseSpeedBadge(resp.responseTimeHours)}
						<div class="rounded-md bg-brand-light/30 border border-brand-light p-3 space-y-2">
							<!-- Meta row: when + how fast + language -->
							<div class="flex items-center gap-2 text-xs flex-wrap">
								<span class={['px-2 py-0.5 rounded-full font-medium', speedBadge.cls]}>
									{speedBadge.icon} {speedBadge.label}
								</span>
								<span class="text-text-3">·</span>
								<span class="text-text-2">{fmtRelativeHours(resp.responseTimeHours)} sonra cevaplandı</span>
								<span class="text-text-3">·</span>
								<span class="text-text-2 inline-flex items-center gap-1">
									<span>{langFlag(resp.language)}</span>
									{#if isLangMatch}
										<span title="Yorum diliyle eşleşiyor">Yorum diliyle aynı</span>
									{:else}
										<span class="text-warning" title="Yorum diliyle eşleşmiyor">
											{langFlag(review.lang)} dilinde değil
										</span>
									{/if}
								</span>
								<span class="ml-auto text-text-3" title={resp.respondedAt}>
									{fmtDate(resp.respondedAt)}
								</span>
							</div>

							<!-- Body -->
							<button
								onclick={() => (ownerResponseExpanded = !ownerResponseExpanded)}
								class="w-full text-left text-sm text-text-1 leading-relaxed"
							>
								{#if ownerResponseExpanded}
									{resp.text}
									<span class="block text-xs text-brand mt-2">Daralt ▲</span>
								{:else}
									<span class="line-clamp-2">{resp.text}</span>
									<span class="block text-xs text-brand mt-2">Tamamını göster ▼</span>
								{/if}
							</button>
						</div>
					{:else}
						{@const hoursSincePublished = hoursSince(review.publishedDate)}
						<div class="rounded-md bg-warning-light/50 border border-warning/30 p-3">
							<div class="flex items-center gap-2 text-sm text-text-1">
								<span>⏳</span>
								<strong>Bu yoruma henüz cevap verilmedi.</strong>
							</div>
							<div class="text-xs text-text-2 mt-1">
								Yayınlanma üzerinden <strong>{fmtRelativeHours(hoursSincePublished)}</strong> geçti.
								{#if hoursSincePublished > 48}
									Cevap için ideal süre kaçtı — yine de bir cevap engagement için değerli.
								{/if}
							</div>
						</div>
					{/if}
				</section>

				<!-- Footer actions -->
				<footer class="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
					{#if review.sourceUrl}
						<a
							href={review.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors"
						>
							<span>{platform.icon}</span>
							<span>{platform.label}'da Aç</span>
							<span class="text-text-3">↗</span>
						</a>
					{/if}
					<button
						class="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 text-sm text-text-2 cursor-not-allowed"
						disabled
						title="Phase 2: response generation (LAD-5)"
					>
						Cevap Öner
						<span
							class="text-xs px-1.5 py-0.5 rounded-full bg-text-3/20 text-text-3 font-mono"
						>
							yakında
						</span>
					</button>
				</footer>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
