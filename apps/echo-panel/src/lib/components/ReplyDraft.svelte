<!--
  ReplyDraft — the LLM reply-drafting panel for one review (G10).

  echo does NOT publish replies. This produces a draft the operator copies and posts
  on the platform themselves, so the whole component is built around one action:
  get text out of here and into the platform's reply box, correctly.

  Two rules the UI must hold, both learned the hard way (see echo-backend
  reviews/replySuggest.ts):

  1. ONLY `reply` is copyable. The Turkish summary exists so an operator who doesn't
     read the guest's language knows what they are about to publish — it must never
     reach the clipboard, or it ends up pasted into Google. The backend separates the
     two fields structurally; the copy button keeps that separation at the UI layer.

  2. `shouldReply: false` is a RESULT, not an error. The model declines to draft for
     racist, abusive or spam reviews (a real case: a 1-star review targeting guests by
     nationality drew an apology that would have publicly dignified it). It arrives as
     a normal 200, and is rendered as a neutral notice — a red error box would read as
     "the system broke" when the system did exactly the right thing.
-->
<script lang="ts">
	import type { ReplySuggestion } from '@talkwo/echo-ui';
	import { Sparkles, Copy, Check, RefreshCw, ExternalLink, ShieldAlert, TriangleAlert } from '@lucide/svelte';

	interface Props {
		reviewId: string;
		platform: string;
		/** Canonical review URL. Per-review deep link on TripAdvisor/Google; on Booking
		 *  it is the hotel page (the platform exposes no per-review URL). */
		url: string | null;
		/** false for platforms with no reply channel at all — the button is not rendered. */
		canReply: boolean;
	}

	let { reviewId, platform, url, canReply }: Props = $props();

	let draft = $state<ReplySuggestion | null>(null);
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let copied = $state(false);

	// Booking gives no per-review URL, so the link lands on the hotel page and the
	// operator still has to find the review. Saying so up front beats a link that
	// silently does less than the others.
	const deepLink = $derived(platform.toLowerCase() !== 'booking');
	const linkLabel = $derived(deepLink ? 'Platformda aç ve yanıtla' : 'Otel sayfasını aç (yorumu elle bul)');

	async function generate(regenerate = false) {
		loading = true;
		errorMsg = null;
		copied = false;
		try {
			const r = await fetch('/api/reply-suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reviewId, regenerate })
			});
			if (!r.ok) {
				// The backend's own limits speak here: a daily cap or a missing key are
				// operator-legible states, not generic failures.
				const status = r.status;
				errorMsg =
					status === 429
						? 'Bu otel için bugünkü öneri sınırına ulaşıldı. Yarın tekrar deneyin.'
						: status === 503
							? 'Yanıt önerisi bu kurulumda kapalı (model anahtarı tanımlı değil).'
							: status === 504
								? 'Model zamanında yanıt vermedi. Tekrar deneyin.'
								: status === 422
									? 'Bu yorum için taslak üretilemedi.'
									: 'Yanıt önerisi alınamadı.';
				return;
			}
			draft = await r.json();
		} catch {
			errorMsg = 'Bağlantı hatası — yanıt önerisi alınamadı.';
		} finally {
			loading = false;
		}
	}

	async function copyReply() {
		if (!draft?.reply) return;
		try {
			await navigator.clipboard.writeText(draft.reply);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			errorMsg = 'Panoya kopyalanamadı — metni elle seçip kopyalayabilirsiniz.';
		}
	}
</script>

<div class="mt-2.5 rounded-xl border border-border bg-surface-1 p-3">
	{#if !canReply}
		<p class="flex items-start gap-2 text-[12.5px] leading-snug text-text-3">
			<TriangleAlert size={14} strokeWidth={2} class="mt-px shrink-0" />
			Bu platform otel yanıtı kabul etmiyor — taslak üretilse de yayınlanamaz.
		</p>
	{:else if !draft && !loading && !errorMsg}
		<button
			onclick={() => generate(false)}
			class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
		>
			<Sparkles size={13} strokeWidth={2.5} />
			Yanıt öner
		</button>
	{:else if loading}
		<p class="py-1 text-[12.5px] text-text-3">Taslak hazırlanıyor…</p>
	{:else if errorMsg}
		<p class="text-[12.5px] leading-snug text-danger">{errorMsg}</p>
		<button
			onclick={() => generate(false)}
			class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-semibold text-text-2 hover:bg-surface-2"
		>
			<RefreshCw size={12} strokeWidth={2} />
			Tekrar dene
		</button>
	{:else if draft && !draft.shouldReply}
		<!-- A verdict, not a failure: neutral tone, no red. -->
		<div class="flex items-start gap-2">
			<ShieldAlert size={15} strokeWidth={2} class="mt-px shrink-0 text-warning" />
			<div class="min-w-0">
				<p class="text-[12.5px] font-semibold text-text-1">Bu yoruma yanıt önerilmiyor</p>
				<p class="mt-0.5 text-[12.5px] leading-snug text-text-2">{draft.noReplyReason}</p>
				<p class="mt-1.5 text-[11.5px] leading-snug text-text-3">
					Yine de yanıtlamak isterseniz metni kendiniz yazmalısınız.
				</p>
			</div>
		</div>
	{:else if draft}
		<div class="flex items-center justify-between gap-2">
			<span class="text-[11px] font-bold uppercase tracking-wide text-text-3">
				Taslak yanıt · {draft.detectedLang}
			</span>
			{#if draft.cached}
				<span class="text-[10.5px] text-text-3" title="Daha önce üretildi — yeni model çağrısı yapılmadı">
					kayıtlı taslak
				</span>
			{/if}
		</div>

		<!-- The ONLY publishable text. Selectable so an operator can grab part of it. -->
		<p class="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-text-1">{draft.reply}</p>

		{#if draft.summaryTr}
			<!-- Explicitly marked as internal: no copy affordance, muted, labelled. -->
			<p class="mt-2 border-t border-surface-2 pt-2 text-[11.5px] leading-snug text-text-3">
				<span class="font-bold uppercase tracking-wide">Türkçe özet (yayınlamayın):</span>
				{draft.summaryTr}
			</p>
		{/if}

		<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
			<button
				onclick={copyReply}
				class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
			>
				{#if copied}
					<Check size={13} strokeWidth={2.5} /> Kopyalandı
				{:else}
					<Copy size={13} strokeWidth={2.5} /> Yanıtı kopyala
				{/if}
			</button>

			{#if url}
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
				>
					<ExternalLink size={12.5} strokeWidth={2} />
					{linkLabel}
				</a>
			{/if}

			<button
				onclick={() => generate(true)}
				title="Yeni bir taslak üretir (model çağrısı yapar)"
				class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
			>
				<RefreshCw size={12.5} strokeWidth={2} />
				Yeniden üret
			</button>
		</div>
	{/if}
</div>
