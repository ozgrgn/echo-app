<!--
  ReviewRowActions — the always-visible action cluster on a review row's meta line.

  UX decision (2026-08-01): actions live on the RIGHT HALF of the meta line
  ("Author · date · 3 gündür yanıtsız · TR   [buttons]") because that space was
  empty anyway — the row grows neither taller nor narrower. Text buttons, not
  icon-only: the operators are GR staff, and "İtiraz" has no self-evident icon.

    [✨ Yanıt öner]  — expands the row AND starts drafting in one click (the old
                       flow was expand → find the button → click again).
    [↗ Yoruma git]  — external link to the review. Hidden when the platform gives
                       no URL; Booking gets a "hotel page only" tooltip.
    [⋯]             — rare actions: the removal-dispute ("İtiraz") lifecycle.

  Dispute state is written optimistically (badge flips instantly, PATCH follows,
  revert on failure) — an operator triaging 50 rows must not wait on a spinner
  for a single-field flag.
-->
<script lang="ts">
	import { Sparkles, ExternalLink, Ellipsis, Languages } from '@lucide/svelte';
	import type { ReviewDisputeState, DisputeStatus } from '@talkwo/echo-ui';

	/** Translate button phases — the PAGE owns the translation text (it renders the
	 *  review body); this component only renders the matching button face. */
	export type TxState = 'idle' | 'loading' | 'shown' | 'hidden' | 'error';

	interface Props {
		reviewId: string;
		platform: string;
		/** Canonical review URL (hotel page on Booking), or null → link hidden. */
		url: string | null;
		/** Show the "Yanıt öner" button at all (reply-capable platform, has text, unanswered). */
		canSuggest: boolean;
		/** Translate button state; null hides the button (Turkish or textless review). */
		txState?: TxState | null;
		/** Initial dispute state from the list payload. */
		dispute?: ReviewDisputeState;
		/** Parent expands the row and auto-starts the draft. */
		onsuggest: () => void;
		/** Parent fetches/toggles the translation. */
		ontranslate?: () => void;
	}

	let {
		reviewId,
		platform,
		url,
		canSuggest,
		txState = null,
		dispute: initialDispute,
		onsuggest,
		ontranslate
	}: Props = $props();

	const TX_LABEL: Record<TxState, string> = {
		idle: 'Çevir',
		loading: 'Çevriliyor…',
		shown: 'Aslını göster',
		hidden: 'Çeviriyi göster',
		error: 'Çevrilemedi — tekrar dene'
	};

	// Intentional init-from-prop: the list payload seeds the state, then THIS component
	// owns it (optimistic writes). Rows are keyed by review id, so it never goes stale
	// within a mounted row.
	// svelte-ignore state_referenced_locally
	let dispute = $state<ReviewDisputeState | null>(initialDispute ?? null);
	let menuOpen = $state(false);
	let saving = $state(false);
	let failed = $state(false);

	// Booking exposes no per-review URL — the link lands on the hotel page.
	const isBooking = $derived(platform.toLowerCase() === 'booking');

	const BADGE: Record<DisputeStatus, { label: string; cls: string }> = {
		requested: { label: 'itiraz edildi', cls: 'bg-warning-light text-warning' },
		removed: { label: 'kaldırıldı', cls: 'bg-success-light text-success' },
		rejected: { label: 'itiraz reddedildi', cls: 'bg-surface-2 text-text-3' }
	};

	/** Menu items for the CURRENT state — the lifecycle, not a flat action list. */
	const menuItems = $derived.by((): { label: string; to: DisputeStatus | 'none' }[] => {
		switch (dispute?.status) {
			case undefined:
				return [{ label: 'İtiraz başlat (kaldırma talebi)', to: 'requested' }];
			case 'requested':
				return [
					{ label: 'Platform kaldırdı olarak işaretle', to: 'removed' },
					{ label: 'İtiraz reddedildi olarak işaretle', to: 'rejected' },
					{ label: 'İtirazı geri al', to: 'none' }
				];
			default:
				// removed / rejected: verdict recorded; only correction remains.
				return [{ label: 'İtiraz kaydını sıfırla', to: 'none' }];
		}
	});

	async function setStatus(to: DisputeStatus | 'none') {
		menuOpen = false;
		if (saving) return;
		const prev = dispute;
		// Optimistic flip; updatedAt is cosmetic locally, the server writes the real one.
		dispute = to === 'none' ? null : { status: to, updatedAt: new Date().toISOString() };
		saving = true;
		failed = false;
		try {
			const r = await fetch('/api/review-dispute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reviewId, status: to })
			});
			if (!r.ok) throw new Error(String(r.status));
			dispute = (await r.json()).dispute ?? null;
		} catch {
			dispute = prev;
			failed = true;
			setTimeout(() => (failed = false), 4000);
		} finally {
			saving = false;
		}
	}
</script>

<span class="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap">
	{#if failed}
		<span class="text-[10.5px] font-semibold text-danger">kaydedilemedi</span>
	{:else if dispute}
		<span class="rounded px-1.5 py-0.5 text-[10.5px] font-bold {BADGE[dispute.status].cls}">
			{BADGE[dispute.status].label}
		</span>
	{/if}

	{#if txState && ontranslate}
		<button
			onclick={ontranslate}
			disabled={txState === 'loading'}
			class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-60
				{txState === 'error' ? 'text-danger' : 'text-text-2'}"
		>
			<Languages size={11} strokeWidth={2.5} />
			{TX_LABEL[txState]}
		</button>
	{/if}

	{#if canSuggest}
		<button
			onclick={onsuggest}
			class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-brand transition-colors hover:bg-surface-2"
		>
			<Sparkles size={11} strokeWidth={2.5} />
			Yanıt öner
		</button>
	{/if}

	{#if url}
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			title={isBooking ? 'Booking yorum linki vermez — otel sayfası açılır' : 'Yorumu platformda aç'}
			class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-text-2 transition-colors hover:bg-surface-2"
		>
			<ExternalLink size={11} strokeWidth={2.5} />
			Yoruma git
		</a>
	{/if}

	<span class="relative inline-flex">
		<button
			onclick={() => (menuOpen = !menuOpen)}
			title="Diğer işlemler"
			aria-haspopup="menu"
			aria-expanded={menuOpen}
			class="inline-flex items-center rounded-md border border-border px-1.5 py-1 text-text-2 transition-colors hover:bg-surface-2"
		>
			<Ellipsis size={13} strokeWidth={2.5} />
		</button>

		{#if menuOpen}
			<!-- Invisible backdrop: closes the menu on any outside click without a
			     document-level listener per row. -->
			<button
				class="fixed inset-0 z-10 cursor-default"
				aria-label="Menüyü kapat"
				onclick={() => (menuOpen = false)}
			></button>
			<!-- whitespace-normal: the action cluster wrapper is nowrap (buttons must stay
			     one line), and an absolutely positioned child INHERITS that — without the
			     reset the footer note runs out of the box instead of wrapping. -->
			<div
				role="menu"
				class="absolute right-0 top-full z-20 mt-1 w-64 whitespace-normal rounded-lg border border-border bg-surface-1 py-1 shadow-card"
			>
				{#each menuItems as item (item.to)}
					<button
						role="menuitem"
						onclick={() => setStatus(item.to)}
						disabled={saving}
						class="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-text-1 transition-colors hover:bg-surface-2 disabled:opacity-60"
					>
						{item.label}
					</button>
				{/each}
				<p class="border-t border-surface-2 px-3 pb-1 pt-1.5 text-[10.5px] leading-snug text-text-3">
					İtiraz kaydı yalnız takip içindir — yorumu platform kaldırır, ECHO kaldırmaz.
				</p>
			</div>
		{/if}
	</span>
</span>
