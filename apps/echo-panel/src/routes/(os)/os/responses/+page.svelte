<!--
  ECHO OS — "Yorumlar" lens (/os/responses).

  The operator's daily work surface. Before this page, response management was
  scattered: ResponseAnalytics sat on Genel, on platform detail AND on department
  detail, while ResponseInbox lived only inside platform detail — so "let me go
  through the reviews" had no home.

  Two modes over ONE list, because they answer different questions:
    • "En acil"  → GET /v1/responses/queue: unanswered only, ordered by the backend's
                   priority score (negativity × freshness × has-text).
    • "Tüm yorumlar" → GET /v1/reviews: every review, newest first, with filters
                   (answered/unanswered, platform, sentiment). Keyset-paged.

  Reply drafting hangs off each row (ReplyDraft). echo never publishes a reply —
  the operator copies the draft and posts it on the platform.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { windowParam, parseOsWindow } from '$lib/config/window';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import OsBackNav from '$lib/components/OsBackNav.svelte';
	import ReplyDraft from '$lib/components/ReplyDraft.svelte';
	import { MessageSquare, Flame } from '@lucide/svelte';
	import type { ResponseStats, ResponseQueueItem } from '@talkwo/echo-ui';
	import type { Review } from '@talkwo/echo-core';

	// Platforms that accept no owner reply at all — measured 2026-07-27: HolidayCheck
	// carries 0 owner responses across 49k reviews. Rows still render (the review is
	// worth reading); only the drafting affordance is withheld.
	//
	// This MIRRORS echo-backend's RESPONSE_RATE_EXCLUDED_PLATFORMS env, which is the
	// authority — the drafting endpoint refuses these platforms with a 422 regardless
	// of what this list says. Hiding the button here is a courtesy so the operator is
	// not offered an action that would fail. If a platform ever becomes reply-capable,
	// the env drops it and THIS list has to follow, or the button stays hidden on a
	// channel that now works.
	const NO_REPLY_PLATFORMS = new Set(['holidaycheck']);

	type Mode = 'urgent' | 'all';
	type AnsweredFilter = 'all' | 'without' | 'with';

	let mode = $state<Mode>('urgent');
	let answered = $state<AnsweredFilter>('all');
	let platformFilter = $state<string>('');

	let stats = $state<ResponseStats | null>(null);
	let queue = $state<ResponseQueueItem[]>([]);
	let reviews = $state<Review[]>([]);
	let nextCursor = $state<string | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let errored = $state(false);
	let expandedId = $state<string | null>(null);

	const windowQ = $derived(windowParam(parseOsWindow(page.url.searchParams.get('window'))));

	async function loadStats(w: string | undefined) {
		const qs = new URLSearchParams({
			resource: 'responseStats',
			...(w ? { window: w } : {}),
			...(platformFilter ? { platform: platformFilter } : {})
		});
		const r = await fetch(`/api/os/data?${qs}`);
		stats = r.ok ? await r.json() : null;
	}

	async function loadList(w: string | undefined) {
		loading = true;
		errored = false;
		expandedId = null;
		try {
			if (mode === 'urgent') {
				const qs = new URLSearchParams({
					resource: 'responseQueue',
					limit: '50',
					...(platformFilter ? { platform: platformFilter } : {})
				});
				const r = await fetch(`/api/os/data?${qs}`);
				if (!r.ok) throw new Error(String(r.status));
				queue = (await r.json()).items ?? [];
				nextCursor = null;
			} else {
				const qs = new URLSearchParams({
					resource: 'reviews',
					limit: '40',
					...(platformFilter ? { platform: platformFilter } : {}),
					...(answered === 'all' ? {} : { response: answered })
				});
				const r = await fetch(`/api/os/data?${qs}`);
				if (!r.ok) throw new Error(String(r.status));
				const res = await r.json();
				reviews = res.items ?? [];
				nextCursor = res.nextCursor ?? null;
			}
		} catch {
			errored = true;
			queue = [];
			reviews = [];
		} finally {
			loading = false;
		}
	}

	/** Keyset paging — the cursor encodes (publishedAt, id), so pages never skip or
	 *  repeat a review the way an offset would when new reviews land mid-scroll. */
	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		try {
			const qs = new URLSearchParams({
				resource: 'reviews',
				limit: '40',
				cursor: nextCursor,
				...(platformFilter ? { platform: platformFilter } : {}),
				...(answered === 'all' ? {} : { response: answered })
			});
			const r = await fetch(`/api/os/data?${qs}`);
			if (r.ok) {
				const res = await r.json();
				reviews = [...reviews, ...(res.items ?? [])];
				nextCursor = res.nextCursor ?? null;
			}
		} finally {
			loadingMore = false;
		}
	}

	// Reading page.url inside the effect subscribes it to the rail's ?window= updates.
	$effect(() => {
		const w = windowQ;
		// Referenced so the effect re-runs when a filter changes.
		void mode;
		void answered;
		void platformFilter;
		void loadStats(w);
		void loadList(w);
	});

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	// null median = no answered review carries a reply date (always true on Booking).
	// It must read as unmeasured, never as an instant reply.
	function hoursLabel(h: number | null): string {
		if (h == null) return '—';
		if (h < 24) return `${Math.round(h)} sa`;
		return `${Math.round(h / 24)} gün`;
	}

	function ratingTone(r5: number | null): string {
		if (r5 == null) return 'bg-surface-2 text-text-2';
		if (r5 < 3) return 'bg-danger-light text-danger';
		if (r5 < 4) return 'bg-warning-light text-warning';
		return 'bg-success-light text-success';
	}
	function railTone(r5: number | null): string {
		if (r5 == null) return 'bg-text-3/40';
		if (r5 < 3) return 'bg-danger';
		if (r5 < 4) return 'bg-warning';
		return 'bg-success';
	}
	function prioTone(p: number): string {
		if (p >= 60) return 'bg-danger-light text-danger';
		if (p >= 25) return 'bg-warning-light text-warning';
		return 'bg-surface-2 text-text-2';
	}
	function ageLabel(days: number): string {
		if (days <= 0) return 'bugün';
		if (days < 30) return `${days} gündür yanıtsız`;
		if (days < 365) return `${Math.floor(days / 30)} aydır yanıtsız`;
		return `${Math.floor(days / 365)} yıldır yanıtsız`;
	}
	const canReply = (platform: string) => !NO_REPLY_PLATFORMS.has(platform.toLowerCase());

	const MODES: { k: Mode; l: string; hint: string }[] = [
		{ k: 'urgent', l: 'En acil', hint: 'Yanıtsızlar, aciliyet sırasıyla' },
		{ k: 'all', l: 'Tüm yorumlar', hint: 'Hepsi, en yeniden eskiye' }
	];
	const ANSWERED: { k: AnsweredFilter; l: string }[] = [
		{ k: 'all', l: 'Hepsi' },
		{ k: 'without', l: 'Yanıtsız' },
		{ k: 'with', l: 'Yanıtlanmış' }
	];
</script>

<OsBackNav />

<!-- KPI strip -->
<div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
	<StatTile
		label="Yanıt oranı"
		value={stats ? pct(stats.rate) : '—'}
		caption={stats ? `${stats.withResponse} / ${stats.total} yorum` : ''}
	/>
	<StatTile
		label="Medyan yanıt süresi"
		value={stats ? hoursLabel(stats.medianResponseTimeHours) : '—'}
		caption={stats && stats.medianResponseTimeHours == null
			? 'bu kanalda yanıt tarihi yok'
			: stats
				? `${stats.responseTimeKnownCount} ölçülebilir yanıt`
				: ''}
	/>
	<StatTile
		label="Yanıtsız"
		value={stats ? String(stats.unanswered.total) : '—'}
		caption={stats ? 'yanıt bekleyen yorum' : ''}
	/>
	<StatTile
		label="Yanıtsız olumsuz"
		value={stats ? String(stats.unanswered.negative) : '—'}
		tone={stats && stats.unanswered.negative > 0 ? 'danger' : undefined}
		caption="önce bunlar"
	/>
</div>

<SectionCard title="Yorumlar" icon={MessageSquare} hint={MODES.find((m) => m.k === mode)?.hint}>
	<!-- Controls -->
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<div class="inline-flex rounded-[11px] bg-surface-2 p-1">
			{#each MODES as m (m.k)}
				<button
					onclick={() => (mode = m.k)}
					class="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors
						{mode === m.k ? 'bg-surface-1 text-text-1 shadow-card' : 'text-text-2'}"
				>
					{m.l}
				</button>
			{/each}
		</div>

		{#if mode === 'all'}
			<div class="inline-flex rounded-[11px] bg-surface-2 p-1">
				{#each ANSWERED as a (a.k)}
					<button
						onclick={() => (answered = a.k)}
						class="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors
							{answered === a.k ? 'bg-surface-1 text-text-1 shadow-card' : 'text-text-2'}"
					>
						{a.l}
					</button>
				{/each}
			</div>
		{/if}

		{#if stats?.byPlatform?.length}
			<select
				bind:value={platformFilter}
				class="rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2"
			>
				<option value="">Tüm platformlar</option>
				{#each stats.byPlatform as p (p.platform)}
					<option value={p.platform}>{p.platform} ({p.total})</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if loading}
		<p class="py-10 text-center text-sm text-text-3">Yorumlar yükleniyor…</p>
	{:else if errored}
		<p class="py-10 text-center text-sm text-text-3">Yorumlar alınamadı. Sayfayı yenileyin.</p>
	{:else if mode === 'urgent'}
		{#if queue.length === 0}
			<p class="py-10 text-center text-sm text-text-3">
				Yanıt bekleyen yorum yok — tüm yorumlar yanıtlanmış. 🎉
			</p>
		{:else}
			<ul class="flex flex-col">
				{#each queue as r (r.id)}
					{@const open = expandedId === r.id}
					<li class="grid grid-cols-[3px_1fr_auto] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
						<span class="mt-1 h-full w-[3px] rounded-full {railTone(r.rating5)}"></span>
						<div class="min-w-0">
							<button class="w-full text-left" onclick={() => (expandedId = open ? null : r.id)}>
								<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
									<span class="rounded px-1.5 py-0.5 text-[11px] font-extrabold {ratingTone(r.rating5)}">
										{r.rating != null ? `${r.rating}★` : '—'}
									</span>
									<span class="text-[11px] font-semibold uppercase tracking-wide text-text-3">{r.platform}</span>
									{#if r.title}
										<span class="truncate text-[13px] font-semibold text-text-1">{r.title}</span>
									{/if}
								</div>
								{#if r.text}
									<p class="mt-1 text-[13px] leading-snug text-text-1 {open ? '' : 'line-clamp-2'}">"{r.text}"</p>
								{:else}
									<p class="mt-1 text-[12.5px] italic text-text-3">Metinsiz yorum (yalnız puan).</p>
								{/if}
								<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-3">
									{#if r.author}<span class="font-semibold text-text-2">{r.author}</span><span>·</span>{/if}
									{#if r.publishedDate}<span>{r.publishedDate.slice(0, 10)}</span><span>·</span>{/if}
									<span class="font-semibold text-warning">{ageLabel(r.ageDays)}</span>
									{#if r.lang}<span>·</span><span class="uppercase">{r.lang}</span>{/if}
								</div>
							</button>
							{#if open && r.text}
								<ReplyDraft reviewId={r.id} platform={r.platform} url={r.url} canReply={canReply(r.platform)} />
							{/if}
						</div>
						<span
							class="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-extrabold {prioTone(r.priority)}"
							title="Öncelik skoru: olumsuzluk × tazelik × metin"
						>
							{#if r.priority >= 60}<Flame size={12} strokeWidth={2.5} />{/if}
							{r.priority.toFixed(0)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if reviews.length === 0}
		<p class="py-10 text-center text-sm text-text-3">Bu filtrelerde yorum yok.</p>
	{:else}
		<ul class="flex flex-col">
			{#each reviews as r (r.id)}
				{@const open = expandedId === r.id}
				{@const r5 = r.rating ?? null}
				<li class="grid grid-cols-[3px_1fr] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
					<span class="mt-1 h-full w-[3px] rounded-full {railTone(r5)}"></span>
					<div class="min-w-0">
						<button class="w-full text-left" onclick={() => (expandedId = open ? null : r.id)}>
							<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
								<span class="rounded px-1.5 py-0.5 text-[11px] font-extrabold {ratingTone(r5)}">
									{r.rating != null ? `${r.rating}★` : '—'}
								</span>
								<span class="text-[11px] font-semibold uppercase tracking-wide text-text-3">{r.platform}</span>
								{#if r.ownerResponse}
									<span class="rounded bg-success-light px-1.5 py-0.5 text-[10.5px] font-bold text-success">
										yanıtlandı
									</span>
								{:else}
									<span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-text-3">
										yanıtsız
									</span>
								{/if}
								{#if r.title}
									<span class="truncate text-[13px] font-semibold text-text-1">{r.title}</span>
								{/if}
							</div>
							{#if r.text}
								<p class="mt-1 text-[13px] leading-snug text-text-1 {open ? '' : 'line-clamp-2'}">"{r.text}"</p>
							{:else}
								<p class="mt-1 text-[12.5px] italic text-text-3">Metinsiz yorum (yalnız puan).</p>
							{/if}
							<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-3">
								{#if r.publishedDate}<span>{r.publishedDate.slice(0, 10)}</span>{/if}
								{#if r.lang}<span>·</span><span class="uppercase">{r.lang}</span>{/if}
							</div>
						</button>

						{#if open}
							{#if r.ownerResponse}
								<!-- Already answered: show the published reply instead of drafting a new
								     one. Re-drafting over an existing reply is not a real workflow. -->
								<div class="mt-2 rounded-xl border border-border bg-surface-2/50 p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-text-3">
										Yayınlanan yanıt
										{#if r.ownerResponse.respondedAt}
											· {r.ownerResponse.respondedAt.slice(0, 10)}
										{/if}
									</p>
									<p class="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-2">
										{r.ownerResponse.text}
									</p>
								</div>
							{:else if r.text}
								<ReplyDraft
									reviewId={r.id}
									platform={r.platform}
									url={r.sourceUrl ?? null}
									canReply={canReply(r.platform)}
								/>
							{/if}
						{/if}
					</div>
				</li>
			{/each}
		</ul>

		{#if nextCursor}
			<button
				onclick={loadMore}
				disabled={loadingMore}
				class="mt-3 w-full rounded-lg border border-border py-2 text-[12.5px] font-semibold text-text-2 transition-colors hover:bg-surface-2 disabled:opacity-60"
			>
				{loadingMore ? 'Yükleniyor…' : 'Daha fazla yorum'}
			</button>
		{/if}
	{/if}
</SectionCard>
