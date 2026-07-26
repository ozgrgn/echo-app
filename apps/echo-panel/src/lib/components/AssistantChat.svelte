<!--
  AssistantChat — one radar assist thread: message history + streaming composer.
  Used by AssistantPanel for all three entry points (Gündem thread click, alert
  "Analiz et", Sohbet). Talks ONLY to the same-origin proxies:
    GET  /api/agenda?resource=thread&threadId=…      → { thread{messages}, followUps }
    POST /api/agenda/stream { threadId, content, … } → SSE (token | chart | done | error)

  v1 rendering contract: text messages + follow-up pills + a minimal chart stub
  (title only — the full chart renderer lands with the chart schema work). Tool
  events are ignored; radar streams tokens only after evidence is gathered.
-->
<script lang="ts">
	import { ArrowUp, ArrowLeft, Sparkles } from '@lucide/svelte';
	import { page } from '$app/state';
	import { parseOsWindow } from '$lib/config/window';

	type ChatMessage = {
		role: 'user' | 'assistant' | 'tool';
		content?: string | null;
		persona?: string | null;
		chart?: unknown;
		ts?: string;
	};
	type FollowUp = { label: string; content: string };

	interface Props {
		threadId: string;
		title?: string;
		/** From-alert extras: a hidden instruction behind the "Detaylı Analiz" button. */
		analyzeInstruction?: string | null;
		followUps?: FollowUp[];
		/** Auto-sent first turn (e.g. "?" → explainEchoMetric forceTool) — fires once
		 *  after load when the thread is still empty. */
		initialForce?: {
			content: string;
			displayContent?: string;
			forceTool?: { name: string; args?: Record<string, unknown> };
		};
		/** Radar auto-names a placeholder thread from the first message; bubble it up so
		 *  the panel's thread list relabels without a refetch. */
		onrename?: (title: string) => void;
		onback: () => void;
	}
	let {
		threadId,
		title,
		analyzeInstruction = null,
		followUps = [],
		initialForce,
		onrename,
		onback
	}: Props = $props();

	// Local override of the header label once radar reports the auto-generated title.
	let liveTitle = $state<string | null>(null);

	// Sayfada açık olan dönem — her mesajla birlikte gider, böylece asistan skorları
	// kullanıcının GÖRDÜĞÜ pencereden okur. URL tek doğru kaynak: rail'in pencere seçicisi
	// ?window= yazar, sohbet de oradan okur (ayrı bir kopya tutmak ikisini ayrıştırırdı).
	const uiWindow = $derived(parseOsWindow(page.url.searchParams.get('window')));
	const shownTitle = $derived(liveTitle ?? title ?? 'Konu');

	// Minimal, dependency-free markdown for assistant bubbles. The model emits panel
	// markdown (### headings, **bold**, - lists, `code`); rendering it raw read as
	// noise. SAFETY: the raw text is HTML-ESCAPED FIRST, then a small whitelist of
	// markdown spans is re-introduced — no other HTML can survive, so {@html} is safe.
	function escapeHtml(s: string): string {
		return s
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;');
	}
	function mdInline(s: string): string {
		return (
			s
				// Bold FIRST (** before *), then single-asterisk and underscore italics. Underscores
				// only count when they hug the word (a_b stays literal, so metric paths and
				// snake_case keys survive). Alert seeds emit *…* and _Nasıl hesaplandı:_ — before
				// this they leaked as raw asterisks into the bubble.
				.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
				.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>')
				.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, '$1<em>$2</em>')
				.replace(/`([^`]+)`/g, '<code class="rounded bg-surface-2 px-1 text-[11.5px]">$1</code>')
		);
	}
	function renderMarkdown(text: string): string {
		const lines = escapeHtml(text).split('\n');
		const out: string[] = [];
		let inList = false;
		for (const line of lines) {
			const h = line.match(/^\s{0,3}(#{1,4})\s+(.*)$/);
			const li = line.match(/^\s*[-*•]\s+(.*)$/);
			if (li) {
				if (!inList) {
					out.push('<ul class="my-1 list-disc space-y-0.5 pl-4">');
					inList = true;
				}
				out.push(`<li>${mdInline(li[1])}</li>`);
				continue;
			}
			if (inList) {
				out.push('</ul>');
				inList = false;
			}
			if (h) out.push(`<div class="mt-2 mb-0.5 font-bold">${mdInline(h[2])}</div>`);
			else if (line.trim() === '') out.push('<div class="h-1.5"></div>');
			else out.push(`<div>${mdInline(line)}</div>`);
		}
		if (inList) out.push('</ul>');
		return out.join('');
	}

	// Persona badge labels (radar personaCatalog keys → short Turkish labels).
	const PERSONA_LABEL: Record<string, string> = {
		reputation: 'İtibar',
		tripadvisor: 'TripAdvisor Uzmanı',
		booking: 'Booking Uzmanı',
		google: 'Google Uzmanı',
		holidaycheck: 'HolidayCheck Uzmanı'
	};

	let messages = $state<ChatMessage[]>([]);
	// Filled on load: server-derived followUps win, the caller's prop is the fallback
	// (read inside the closure so the reference stays reactive-safe).
	let pills = $state<FollowUp[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let streaming = $state(false);
	let draft = $state('');
	let scroller = $state<HTMLElement | null>(null);
	// Charts streamed during the CURRENT turn (v1: title stubs under the reply).
	let turnCharts = $state<{ title?: string }[]>([]);

	// Analyze button shows until the thread has any assistant reply (then pills take over).
	const showAnalyze = $derived(
		!!analyzeInstruction && !messages.some((m) => m.role === 'assistant' && m.content)
	);
	const visible = $derived(
		messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
	);

	$effect(() => {
		void threadId;
		loadThread();
	});

	async function loadThread() {
		loading = true;
		loadError = null;
		try {
			const res = await fetch(
				`/api/agenda?resource=thread&threadId=${encodeURIComponent(threadId)}`
			);
			if (!res.ok) throw new Error(`thread ${res.status}`);
			const data = await res.json();
			messages = (data.thread?.messages ?? []) as ChatMessage[];
			const serverPills = Array.isArray(data.followUps) ? (data.followUps as FollowUp[]) : [];
			pills = serverPills.length ? serverPills : followUps;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Konu yüklenemedi';
		} finally {
			loading = false;
			queueMicrotask(scrollDown);
		}
		// "?" handoff: fire the forced first turn exactly once, on a still-empty thread.
		if (initialForce && !forcedSent && !messages.some((m) => m.role === 'user')) {
			forcedSent = true;
			void send(initialForce.content, initialForce.displayContent, initialForce.forceTool);
		}
	}
	let forcedSent = false;

	function scrollDown() {
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	}

	/** One chat turn: optimistic user bubble + a live assistant bubble fed by SSE tokens. */
	async function send(content: string, displayContent?: string, forceTool?: { name: string; args?: Record<string, unknown> }) {
		if (streaming || !content.trim()) return;
		streaming = true;
		turnCharts = [];
		messages = [...messages, { role: 'user', content: displayContent ?? content }];
		// Live bubble mutated in place as tokens arrive (index-stable append).
		messages = [...messages, { role: 'assistant', content: '' }];
		const liveIdx = messages.length - 1;
		queueMicrotask(scrollDown);

		try {
			const res = await fetch('/api/agenda/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					threadId,
					content,
					...(displayContent ? { displayContent } : {}),
					...(forceTool ? { forceTool } : {}),
					// Sayfada açık olan dönem: asistan skorları AYNI pencereden okusun. Yoksa
					// sabit 6 aylık snapshot'tan okuyup ekrandaki tabloyla farklı sayı söylüyordu
					// (owner, 27 Tem). URL tek doğru kaynak — rail seçicisi de oraya yazıyor.
					...(uiWindow ? { uiWindow } : {})
				})
			});
			if (!res.ok || !res.body) {
				const err = await res.json().catch(() => null);
				throw new Error(err?.error ?? err?.message ?? `akış ${res.status}`);
			}
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let cut;
				while ((cut = buf.indexOf('\n\n')) >= 0) {
					handleFrame(buf.slice(0, cut), liveIdx);
					buf = buf.slice(cut + 2);
				}
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Asistan yanıt üretemedi';
			messages[liveIdx] = { ...messages[liveIdx], content: messages[liveIdx].content || `⚠️ ${msg}` };
			messages = [...messages];
		} finally {
			// Empty live bubble (error before first token) → drop it.
			if (!messages[liveIdx]?.content) messages = messages.filter((_, i) => i !== liveIdx);
			streaming = false;
			queueMicrotask(scrollDown);
		}
	}

	function handleFrame(frame: string, liveIdx: number) {
		let event = 'message';
		let data = '';
		for (const line of frame.split('\n')) {
			if (line.startsWith('event:')) event = line.slice(6).trim();
			else if (line.startsWith('data:')) data += line.slice(5).trim();
		}
		let payload: Record<string, unknown> = {};
		try {
			payload = data ? JSON.parse(data) : {};
		} catch {
			return;
		}
		if (event === 'token') {
			messages[liveIdx] = {
				...messages[liveIdx],
				content: (messages[liveIdx].content ?? '') + String(payload.text ?? '')
			};
			messages = [...messages];
			scrollDown();
		} else if (event === 'chart') {
			turnCharts = [...turnCharts, { title: typeof payload.title === 'string' ? payload.title : undefined }];
		} else if (event === 'done') {
			if (typeof payload.persona === 'string') {
				messages[liveIdx] = { ...messages[liveIdx], persona: payload.persona };
				messages = [...messages];
			}
			// Thread was auto-named on this turn → relabel header + notify the list.
			if (typeof payload.title === 'string' && payload.title) {
				liveTitle = payload.title;
				onrename?.(payload.title);
			}
		} else if (event === 'error') {
			const msg = String(payload.message ?? 'Asistan yanıt üretemedi');
			messages[liveIdx] = {
				...messages[liveIdx],
				content: (messages[liveIdx].content || '') + `\n⚠️ ${msg}`
			};
			messages = [...messages];
		}
	}

	// Grow the composer with its content (1 line → max-h-24), then shrink back on send.
	let composerEl = $state<HTMLTextAreaElement | null>(null);
	function autoGrow() {
		if (!composerEl) return;
		composerEl.style.height = 'auto';
		composerEl.style.height = `${Math.min(composerEl.scrollHeight, 96)}px`;
	}

	function submit() {
		const text = draft.trim();
		if (!text) return;
		draft = '';
		if (composerEl) composerEl.style.height = 'auto';
		void send(text);
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	<!-- Thread header -->
	<div class="flex items-center gap-2 border-b border-border pb-2">
		<button
			onclick={onback}
			class="rounded-md p-1 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
			aria-label="Geri"
		>
			<ArrowLeft size={15} />
		</button>
		<span class="min-w-0 flex-1 truncate text-[12.5px] font-bold text-text-1">{shownTitle}</span>
	</div>

	<!-- Messages -->
	<div bind:this={scroller} class="flex-1 space-y-2.5 overflow-y-auto py-3 [scrollbar-width:none]">
		{#if loading}
			<div class="space-y-2.5">
				{#each [0, 1] as i (i)}
					<div class="h-12 animate-pulse rounded-xl bg-surface-2"></div>
				{/each}
			</div>
		{:else if loadError}
			<p class="px-2 text-[12px] text-text-3">{loadError}</p>
		{:else}
			{#if visible.length === 0 && !streaming}
				<div class="flex flex-col items-center px-4 pt-8 text-center">
					<div class="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-text-3">
						<Sparkles size={18} />
					</div>
					<p class="text-[12px] leading-relaxed text-text-3">
						{showAnalyze
							? 'Bu uyarıyı asistanla inceleyin — "Detaylı Analiz" gerçek verilerle başlar.'
							: 'Sorunuzu yazın — asistan yalnızca gerçek verilerinizden konuşur.'}
					</p>
				</div>
			{/if}
			{#each visible as m, i (i)}
				{#if m.role === 'user'}
					<div class="flex justify-end">
						<div class="max-w-[85%] rounded-2xl rounded-br-md bg-talkwo px-3 py-2 text-[12.5px] leading-relaxed text-white">
							{m.content}
						</div>
					</div>
				{:else}
					<div class="flex flex-col items-start gap-1">
						{#if m.persona && PERSONA_LABEL[m.persona]}
							<span class="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-text-2">
								{PERSONA_LABEL[m.persona]}
							</span>
						{/if}
						<div class="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-surface-1 px-3 py-2 text-[12.5px] leading-relaxed text-text-1">
							<!-- eslint-disable-next-line svelte/no-at-html-tags — content is HTML-escaped
							     before whitelist markdown spans are re-added (renderMarkdown). -->
							{@html renderMarkdown(m.content ?? '')}{#if streaming && i === visible.length - 1}<span class="animate-pulse">▍</span>{/if}
						</div>
					</div>
				{/if}
			{/each}
			{#each turnCharts as c, i (i)}
				<div class="rounded-xl border border-dashed border-border bg-surface-2/50 px-3 py-2 text-[11px] text-text-3">
					📊 {c.title ?? 'Grafik'} — grafik görünümü yakında
				</div>
			{/each}
		{/if}
	</div>

	<!-- Analyze + follow-up pills -->
	{#if !loading && (showAnalyze || pills.length)}
		<div class="flex flex-wrap gap-1.5 pb-2">
			{#if showAnalyze && analyzeInstruction}
				<button
					disabled={streaming}
					onclick={() => void send(analyzeInstruction!, 'Detaylı analiz başlatıldı')}
					class="rounded-full bg-talkwo px-3 py-1.5 text-[11.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					Detaylı Analiz
				</button>
			{/if}
			{#each pills as fu (fu.label)}
				<button
					disabled={streaming}
					onclick={() => void send(fu.content, fu.label)}
					class="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1 disabled:opacity-50"
				>
					{fu.label}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Composer — one line tall until the text needs more (autoGrow). A bare rows="1"
	     textarea still reserved ~2 lines here, which read as an oversized empty box. -->
	<div class="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
		<textarea
			rows="1"
			bind:value={draft}
			bind:this={composerEl}
			oninput={autoGrow}
			onkeydown={onKeydown}
			disabled={streaming}
			placeholder={streaming ? 'Asistan yazıyor…' : 'Sorunuzu yazın…'}
			class="max-h-24 min-h-[20px] flex-1 resize-none overflow-y-auto bg-transparent py-0.5 text-[13px] leading-5 text-text-1 outline-none placeholder:text-text-3"
		></textarea>
		<button
			onclick={submit}
			disabled={streaming || !draft.trim()}
			class="grid h-8 w-8 flex-none place-items-center rounded-lg bg-talkwo text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
			aria-label="Gönder"
		>
			<ArrowUp size={16} />
		</button>
	</div>
</div>
