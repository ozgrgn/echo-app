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
		onback: () => void;
	}
	let { threadId, title, analyzeInstruction = null, followUps = [], initialForce, onback }: Props =
		$props();

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
					...(forceTool ? { forceTool } : {})
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
		} else if (event === 'error') {
			const msg = String(payload.message ?? 'Asistan yanıt üretemedi');
			messages[liveIdx] = {
				...messages[liveIdx],
				content: (messages[liveIdx].content || '') + `\n⚠️ ${msg}`
			};
			messages = [...messages];
		}
	}

	function submit() {
		const text = draft.trim();
		if (!text) return;
		draft = '';
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
		<span class="min-w-0 flex-1 truncate text-[12.5px] font-bold text-text-1">{title ?? 'Konu'}</span>
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
						<div class="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border bg-surface-1 px-3 py-2 text-[12.5px] leading-relaxed text-text-1">
							{m.content}{#if streaming && i === visible.length - 1}<span class="animate-pulse">▍</span>{/if}
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

	<!-- Composer -->
	<div class="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
		<textarea
			rows="1"
			bind:value={draft}
			onkeydown={onKeydown}
			disabled={streaming}
			placeholder={streaming ? 'Asistan yazıyor…' : 'Sorunuzu yazın…'}
			class="max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-snug text-text-1 outline-none placeholder:text-text-3"
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
