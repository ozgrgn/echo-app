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
	import { windowParam, parseOsWindow, parseCustomRange } from '$lib/config/window';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import ReplyDraft from '$lib/components/ReplyDraft.svelte';
	import ReviewRowActions from '$lib/components/ReviewRowActions.svelte';
	import { MessageSquare, Flame } from '@lucide/svelte';
	import type { ResponseStats, ResponseQueueItem } from '@talkwo/echo-ui';
	import { PLATFORM_REGISTRY, type Review } from '@talkwo/echo-core';

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

	// Default is the FULL list, not the triage queue (owner decision 2026-08-01):
	// first entry shows the last 7 days of ALL reviews with their replies, so the
	// operator sees what happened, not only what is owed. "En acil" stays one click away.
	let mode = $state<Mode>('all');
	let answered = $state<AnsweredFilter>('all');
	let platformFilter = $state<string>('');

	let stats = $state<ResponseStats | null>(null);
	let queue = $state<ResponseQueueItem[]>([]);
	// G12: in custom mode the review LIST really is cropped to [from, to] — unlike the
	// scores, where `from` never cuts the pool. A list is a raw query over those days;
	// a score is a state as of a day, with memory. Same URL, two honest readings.
	const listRange = $derived(parseCustomRange(page.url.searchParams));

	// ── Date presets ("Tüm yorumlar" only) ──
	// Local shortcuts over the same ?from&to the backend already crops by. 'ozel' is
	// not a picker of its own: it mirrors the rail's custom range and only appears
	// when one is set — two date pickers on one screen would fight over the truth.
	type DatePreset = 'bugun' | 'dun' | 'son7' | 'buay' | 'tumu' | 'ozel';
	let datePreset = $state<DatePreset>('son7');

	// A rail range arriving (or changing) pulls the dropdown onto it; picking a
	// preset afterwards deliberately overrides the rail FOR THIS LIST only. When the
	// rail range is cleared, 'ozel' loses its meaning (and its <option>) — fall back
	// to the default week rather than leaving the select on a value it can't render.
	$effect(() => {
		if (listRange) datePreset = 'ozel';
		else if (datePreset === 'ozel') datePreset = 'son7';
	});

	/** YYYY-MM-DD in the operator's local clock, offset by whole days. */
	function ymd(offsetDays: number): string {
		const d = new Date();
		d.setDate(d.getDate() + offsetDays);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const DATE_PRESETS: { k: DatePreset; l: string }[] = [
		{ k: 'bugun', l: 'Bugün' },
		{ k: 'dun', l: 'Dün' },
		{ k: 'son7', l: 'Son 7 gün' },
		{ k: 'buay', l: 'Bu ay' },
		{ k: 'tumu', l: 'Tümü' }
	];

	const rangeParams = $derived.by((): Record<string, string> => {
		switch (datePreset) {
			case 'ozel':
				return listRange ? { from: listRange.from, to: listRange.to } : {};
			case 'tumu':
				return {};
			case 'bugun':
				return { from: ymd(0), to: ymd(0) };
			case 'dun':
				return { from: ymd(-1), to: ymd(-1) };
			case 'son7':
				return { from: ymd(-6), to: ymd(0) };
			case 'buay':
				return { from: `${ymd(0).slice(0, 8)}01`, to: ymd(0) };
		}
	});

	let reviews = $state<Review[]>([]);
	let nextCursor = $state<string | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let errored = $state(false);
	let expandedId = $state<string | null>(null);
	// Set ONLY by the row-level "Yanıt öner" button: the ReplyDraft it opens starts
	// drafting immediately. A plain row click clears it, so expanding a row to READ
	// never silently spends a model call.
	let autoStartId = $state<string | null>(null);

	function toggleRow(id: string) {
		expandedId = expandedId === id ? null : id;
		autoStartId = null;
	}
	function suggestFor(id: string) {
		expandedId = id;
		autoStartId = id;
	}

	// ── Translation ("Çevir") ──
	// The page owns the translated text because the page renders the review body;
	// ReviewRowActions only renders the button face for the current phase. Once
	// fetched, toggling never re-calls the API — the backend cache protects OTHER
	// operators, this map protects repeat clicks in this session.
	type TxEntry = { titleTr: string; textTr: string; shown: boolean; loading: boolean; error: boolean };
	let tx = $state<Record<string, TxEntry>>({});

	function txStateFor(id: string): 'idle' | 'loading' | 'shown' | 'hidden' | 'error' {
		const t = tx[id];
		if (!t) return 'idle';
		if (t.loading) return 'loading';
		if (t.error) return 'error';
		return t.shown ? 'shown' : 'hidden';
	}

	/** Reviews already in Turkish (or with no text) get no translate button. An empty
	 *  lang is treated as foreign: ingest's tinyld detection covers virtually all rows,
	 *  and when it failed the text is exactly the kind an operator can't read either. */
	const needsTx = (lang: string | null | undefined, text: string | null | undefined) =>
		!!text?.trim() && (lang ?? '').toLowerCase() !== 'tr';

	async function translate(id: string) {
		const cur = tx[id];
		if (cur?.loading) return;
		if (cur && !cur.error) {
			cur.shown = !cur.shown;
			return;
		}
		tx[id] = { titleTr: '', textTr: '', shown: false, loading: true, error: false };
		try {
			const r = await fetch('/api/review-translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reviewId: id })
			});
			if (!r.ok) throw new Error(String(r.status));
			const j = await r.json();
			tx[id] = { titleTr: j.titleTr ?? '', textTr: j.textTr ?? '', shown: true, loading: false, error: false };
		} catch {
			tx[id] = { titleTr: '', textTr: '', shown: false, loading: false, error: true };
		}
	}

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
		autoStartId = null;
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
					...(answered === 'all' ? {} : { response: answered }),
					...rangeParams
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
				...(answered === 'all' ? {} : { response: answered }),
				// The range must ride along on EVERY page, not just the first — otherwise
				// scrolling silently walks out of the selected window.
				...rangeParams
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
		// …including the custom range: without this the list keeps whatever days it first
		// loaded while the rail says "Özel" over them.
		void rangeParams;
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

	/**
	 * Star badge text. rating is the canonical 1–5 value, and echo-backend keeps it at
	 * FULL float precision on purpose — the 1–10 and 1–6 native scales map to fractions
	 * (a Booking 8 becomes 4.111111111111111) and scoring averages want that precision.
	 * Rounding for display is explicitly the frontend's job (see ingest/ratingScale.ts),
	 * so a whole number renders bare and a fraction gets one decimal: "5★", "4.1★".
	 * Tone thresholds below still read the RAW value — rounding first would push a 3.5
	 * into the wrong colour band.
	 */
	function starLabel(rating: number | null): string {
		if (rating == null) return '—';
		const r = Math.round(rating * 10) / 10;
		return `${Number.isInteger(r) ? r : r.toFixed(1)}★`;
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

	/** Display label for a platform key ("holidaycheck" → "HolidayCheck"). Falls back
	 *  to the raw key so an unregistered platform still renders instead of vanishing. */
	const platformLabel = (key: string) => PLATFORM_REGISTRY[key.toLowerCase()]?.label ?? key;

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

<!-- No OsBackNav here: this is a top-level lens page — the global LensTabs row
     right above (or the mobile bottom bar) already carries "Genel" as the way
     home, so a lone Home button under the pills was pure noise. -->

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

			<select
				bind:value={datePreset}
				class="rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2"
			>
				{#each DATE_PRESETS as p (p.k)}
					<option value={p.k}>{p.l}</option>
				{/each}
				{#if listRange}
					<option value="ozel">Özel ({listRange.from} → {listRange.to})</option>
				{/if}
			</select>
		{/if}

		{#if stats?.byPlatform?.length}
			<select
				bind:value={platformFilter}
				class="rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-semibold text-text-2"
			>
				<option value="">Tüm platformlar</option>
				{#each stats.byPlatform as p (p.platform)}
					<option value={p.platform}>{platformLabel(p.platform)} ({p.total})</option>
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
					{@const t = tx[r.id]}
					{@const showTx = !!t?.shown}
					<li class="grid grid-cols-[3px_1fr_auto] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
						<span class="mt-1 h-full w-[3px] rounded-full {railTone(r.rating5)}"></span>
						<div class="min-w-0">
							<button class="w-full text-left" onclick={() => toggleRow(r.id)}>
								<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
									<!-- rating5, NOT rating: /v1/responses/queue serves the platform-native
									     value too, and a Booking 8 rendered as "8★" beside a green (4.1-based)
									     chip — same row, two scales. -->
									<span class="rounded px-1.5 py-0.5 text-[11px] font-extrabold {ratingTone(r.rating5)}">
										{starLabel(r.rating5)}
									</span>
									<span class="text-[11px] font-semibold uppercase tracking-wide text-text-3">{platformLabel(r.platform)}</span>
									{#if showTx}
										<span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-text-3">çeviri</span>
									{/if}
									{#if r.title}
										<span class="truncate text-[13px] font-semibold text-text-1">
											{showTx && t.titleTr ? t.titleTr : r.title}
										</span>
									{/if}
								</div>
								{#if r.text}
									<p class="mt-1 text-[13px] leading-snug text-text-1 {open ? '' : 'line-clamp-2'}">
										"{showTx ? t.textTr : r.text}"
									</p>
								{:else}
									<p class="mt-1 text-[12.5px] italic text-text-3">Metinsiz yorum (yalnız puan).</p>
								{/if}
							</button>
							<!-- Meta line OUTSIDE the expand toggle: it now carries real buttons, and
							     nested interactive elements inside a <button> are invalid HTML. -->
							<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-3">
								{#if r.author}<span class="font-semibold text-text-2">{r.author}</span><span>·</span>{/if}
								{#if r.publishedDate}<span>{r.publishedDate.slice(0, 10)}</span><span>·</span>{/if}
								<span class="font-semibold text-warning">{ageLabel(r.ageDays)}</span>
								{#if r.lang}<span>·</span><span class="uppercase">{r.lang}</span>{/if}
								<ReviewRowActions
									reviewId={r.id}
									platform={r.platform}
									url={r.url}
									canSuggest={canReply(r.platform) && !!r.text}
									txState={needsTx(r.lang, r.text) ? txStateFor(r.id) : null}
									dispute={r.dispute}
									onsuggest={() => suggestFor(r.id)}
									ontranslate={() => translate(r.id)}
								/>
							</div>
							{#if open && r.text}
								<ReplyDraft
									reviewId={r.id}
									platform={r.platform}
									url={r.url}
									canReply={canReply(r.platform)}
									autoStart={autoStartId === r.id}
								/>
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
				{@const t = tx[r.id]}
				{@const showTx = !!t?.shown}
				<li class="grid grid-cols-[3px_1fr] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
					<span class="mt-1 h-full w-[3px] rounded-full {railTone(r5)}"></span>
					<div class="min-w-0">
						<button class="w-full text-left" onclick={() => toggleRow(r.id)}>
							<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
								<span class="rounded px-1.5 py-0.5 text-[11px] font-extrabold {ratingTone(r5)}">
									{starLabel(r.rating)}
								</span>
								<span class="text-[11px] font-semibold uppercase tracking-wide text-text-3">{platformLabel(r.platform)}</span>
								{#if r.ownerResponse}
									<span class="rounded bg-success-light px-1.5 py-0.5 text-[10.5px] font-bold text-success">
										yanıtlandı
									</span>
								{:else}
									<span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-text-3">
										yanıtsız
									</span>
								{/if}
								{#if showTx}
									<span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-text-3">çeviri</span>
								{/if}
								{#if r.title}
									<span class="truncate text-[13px] font-semibold text-text-1">
										{showTx && t.titleTr ? t.titleTr : r.title}
									</span>
								{/if}
							</div>
							{#if r.text}
								<p class="mt-1 text-[13px] leading-snug text-text-1 {open ? '' : 'line-clamp-2'}">
									"{showTx ? t.textTr : r.text}"
								</p>
							{:else}
								<p class="mt-1 text-[12.5px] italic text-text-3">Metinsiz yorum (yalnız puan).</p>
							{/if}
						</button>
						<!-- Meta line outside the toggle — same reasoning as the urgent list. -->
						<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-3">
							{#if r.publishedDate}<span>{r.publishedDate.slice(0, 10)}</span>{/if}
							{#if r.lang}<span>·</span><span class="uppercase">{r.lang}</span>{/if}
							<ReviewRowActions
								reviewId={r.id}
								platform={r.platform}
								url={r.sourceUrl ?? null}
								canSuggest={canReply(r.platform) && !!r.text && !r.ownerResponse}
								txState={needsTx(r.lang, r.text) ? txStateFor(r.id) : null}
								dispute={r.dispute}
								onsuggest={() => suggestFor(r.id)}
								ontranslate={() => translate(r.id)}
							/>
						</div>

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
									autoStart={autoStartId === r.id}
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
