<!--
  AssistantPanel — the right-column assistant shell (ECHO_OS_PLAN.md A1 target).
  In B2 this renders a believable skeleton from mock content; A1 binds it to the
  radar federated brain (SSE stream + tools). Structure mirrors the prototype:
  scope header · thread tabs · daily brief · stream of active topics · composer.
-->
<script lang="ts">
	import { Sparkles, Ellipsis, Plus, ArrowUp, GitCompare, Bell, Target, MessagesSquare, ListTodo, TrendingDown, TrendingUp, Minus } from '@lucide/svelte';
	import { osState } from '$lib/stores/osState.svelte';
	import { MOCK_THREADS, MOCK_BRIEF, MOCK_STREAM, type ThreadStatus } from '$lib/mock/assistant';
	import TalkwoMark from './TalkwoMark.svelte';

	// Active venue name for the scope header (from the SSR session, via the OS layout).
	// Required, not defaulted: the old default hardcoded one real customer's hotel name,
	// which would silently render on every other tenant if the session name went missing.
	//
	// `demo` decides whether the PLACEHOLDER CONTENT renders. The brief and the topic
	// cards quote concrete numbers, and those numbers are the demo venue's — pulled from
	// its fixtures so the demo hangs together. Put them in front of a real customer and
	// they sit next to that customer's own tiles saying something else: a placeholder that
	// looks real and belongs to another hotel. Worse than an obvious one. So a real tenant
	// gets an honest empty shell until the radar brain (A1) is wired.
	let { venueName, demo = false }: { venueName: string; demo?: boolean } = $props();

	// Scope label tracks the active lens (the assistant's identity shifts per lens).
	const scopeLabel = $derived(
		osState.lens.kind === 'platform'
			? `${osState.lens.platform} uzmanı`
			: osState.lens.kind === 'department'
				? `${osState.lens.department} uzmanı`
				: osState.lens.kind === 'competitors'
					? 'Rekabet analisti'
					: 'Otel geneli'
	);

	let active = $state('t-agenda');

	const statusChip: Record<ThreadStatus, string> = {
		open: 'bg-danger-light text-danger',
		tracking: 'bg-warning-light text-warning',
		good: 'bg-success-light text-success'
	};
	const valueTone: Record<'good' | 'bad' | 'neutral', string> = {
		good: 'text-success',
		bad: 'text-danger',
		neutral: 'text-warning'
	};

	let composer = $state('');

	// ── Faz 1 (real tenant): 4 sections fed by /api/agenda (SvelteKit proxy → radar).
	// Shapes mirror lib/server/radarApi.ts; kept loose on purpose — the panel renders
	// what radar sends and must not crash on fields it doesn't know yet.
	type AlertCard = {
		fingerprint: string;
		ruleId?: string;
		title?: string;
		detail?: string;
		severity?: string;
		category?: string;
		categoryLabel?: string;
		sendCount?: number;
		lastSentAt?: string;
	};
	type GoalReport = {
		goal: { goalId: string; label?: string; metricPath: string; target: number; deadline?: string | null };
		progress?: { now: number | null; gap: number | null; weeklyDelta: number | null; trend: string; reached: boolean };
		feasibility?: { verdict: string; verdictTr?: string; evidence?: string };
	};
	type Thread = { threadId?: string; title?: string; source?: string; status?: string };

	type SectionKey = 'agenda' | 'alerts' | 'goals' | 'chat';
	let section = $state<SectionKey>('agenda');
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let alerts = $state<AlertCard[]>([]);
	let goals = $state<GoalReport[]>([]);
	let threads = $state<Thread[]>([]);

	$effect(() => {
		if (demo) return; // demo branch renders fixtures, never fetches
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch('/api/agenda?resource=all');
				if (!res.ok) throw new Error(`agenda ${res.status}`);
				const data = await res.json();
				if (cancelled) return;
				// ECHO panel is the REPUTATION lens of the shared radar store: PMS-domain
				// cards (occupancy dips, meter gaps) stay in Atlas — only reputation here.
				alerts = (data.alerts ?? []).filter((a: AlertCard) => a.category === 'reputation');
				goals = data.goals ?? [];
				threads = data.threads ?? [];
				loadError = data.partial ? 'Bazı bölümler yüklenemedi' : null;
			} catch (e) {
				if (!cancelled) loadError = e instanceof Error ? e.message : 'Gündem yüklenemedi';
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const criticalCount = $derived(alerts.filter((a) => a.severity === 'critical').length);
	const goalsAtRisk = $derived(
		goals.filter((g) => g.progress && !g.progress.reached && g.progress.trend === 'worsening').length
	);

	const sections: { key: SectionKey; label: string }[] = [
		{ key: 'agenda', label: 'Gündem' },
		{ key: 'alerts', label: 'Uyarılar' },
		{ key: 'goals', label: 'Hedefler' },
		{ key: 'chat', label: 'Sohbet' }
	];

	const sevChip = (s?: string) =>
		s === 'critical' ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning';
	const sevLabel = (s?: string) => (s === 'critical' ? 'KRİTİK' : 'UYARI');

	// Goal card badge: the mock's "gidişat" chip. A warming-up series must read as
	// "still filling", not as a flat trend or a failed target; then reached wins;
	// then weekly direction.
	const goalTone = (g: GoalReport) =>
		g.feasibility?.verdict === 'warming_up'
			? { label: 'veri birikiyor', cls: 'bg-surface-2 text-text-3' }
			: g.progress?.reached
				? { label: 'ulaşıldı', cls: 'bg-success-light text-success' }
				: g.progress?.trend === 'worsening'
					? { label: 'gidişat: risk', cls: 'bg-danger-light text-danger' }
					: g.progress?.trend === 'improving'
						? { label: 'yolunda', cls: 'bg-success-light text-success' }
						: { label: 'yatay', cls: 'bg-warning-light text-warning' };

	const fmt = (n: number | null | undefined, digits = 1) =>
		typeof n === 'number' ? n.toFixed(digits).replace(/\.0$/, '') : '—';
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Scope header -->
	<header class="flex items-center gap-2.5 border-b border-border px-4 py-3">
		<TalkwoMark size={22} class="flex-none" />
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-[13px] font-bold text-text-1">
				Talkwo OS
				<span class="rounded-full bg-talkwo/10 px-2 py-0.5 text-[10px] font-bold text-talkwo">{scopeLabel}</span>
			</div>
			<div class="truncate text-[11px] text-text-3">{venueName} · tüm kaynaklar</div>
		</div>
		<button class="rounded-md p-1.5 text-text-3 hover:bg-surface-2" title="Menü">
			<Ellipsis size={16} />
		</button>
	</header>

{#if !demo}
	<!-- Faz 1 (SAG_PANEL_FAZ1 §1.1): 4 sections over live radar data. Tab layout (owner
	     decision 2026-07-16). "Analiz et" stays HIDDEN until A1 (K4); composer visible
	     but passive (K6). -->
	<nav class="flex items-center gap-1 border-b border-border bg-surface-2/40 px-2 py-2">
		{#each sections as s (s.key)}
			<button
				onclick={() => (section = s.key)}
				class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors
					{section === s.key ? 'bg-text-1 text-white' : 'text-text-2 hover:bg-surface-2 hover:text-text-1'}"
			>
				{s.label}
				{#if s.key === 'alerts' && alerts.length}
					<span class="rounded-full px-1.5 text-[10px] font-bold {section === s.key ? 'bg-white/20 text-white' : criticalCount ? 'bg-danger text-white' : 'bg-warning text-white'}">{alerts.length}</span>
				{:else if s.key === 'goals' && goalsAtRisk}
					<span class="rounded-full px-1.5 text-[10px] font-bold {section === s.key ? 'bg-white/20 text-white' : 'bg-danger text-white'}">{goalsAtRisk}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<div class="flex-1 overflow-y-auto p-3 [scrollbar-width:none]">
		{#if loading}
			<div class="flex flex-col gap-2.5">
				{#each [0, 1, 2] as i (i)}
					<div class="h-16 animate-pulse rounded-xl bg-surface-2"></div>
				{/each}
			</div>
		{:else if loadError && !alerts.length && !goals.length && !threads.length}
			<div class="flex h-full flex-col items-center justify-center px-4 text-center">
				<p class="text-[13px] font-semibold text-text-1">Gündem yüklenemedi</p>
				<p class="mt-1.5 text-[12px] leading-relaxed text-text-3">{loadError}</p>
			</div>
		{:else if section === 'agenda'}
			{#if threads.length === 0}
				<div class="flex h-full flex-col items-center justify-center px-4 text-center">
					<div class="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-3">
						<ListTodo size={20} />
					</div>
					<p class="text-[13px] font-semibold text-text-1">Henüz konu yok</p>
					<p class="mt-1.5 text-[12px] leading-relaxed text-text-3">
						Uyarılardan ve hedeflerden doğan konular burada birikecek.
						{#if criticalCount}Şu an <b class="text-danger">{criticalCount} kritik uyarı</b> Uyarılar sekmesinde.{/if}
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2.5">
					{#each threads as t (t.threadId ?? t.title)}
						<button class="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
							<span class="grid h-7 w-7 flex-none place-items-center rounded-lg bg-talkwo/10 text-talkwo">
								<MessagesSquare size={14} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[12.5px] font-bold text-text-1">{t.title ?? 'Konu'}</span>
								<span class="mt-0.5 block text-[11px] text-text-3">{t.source === 'alert' ? 'uyarıdan' : t.source === 'goal' ? 'hedeften' : 'manuel'}</span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		{:else if section === 'alerts'}
			{#if alerts.length === 0}
				<div class="flex h-full flex-col items-center justify-center px-4 text-center">
					<div class="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-success-light text-success">
						<Bell size={20} />
					</div>
					<p class="text-[13px] font-semibold text-text-1">Aktif uyarı yok</p>
					<p class="mt-1.5 text-[12px] text-text-3">Kurallar her sabah taze veriyle çalışıyor.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2.5">
					{#each alerts as a (a.fingerprint)}
						<div class="rounded-xl border border-border bg-surface-1 p-3 {a.severity === 'critical' ? 'border-l-2 border-l-danger' : ''}">
							<div class="flex items-start gap-2">
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase {sevChip(a.severity)}">{sevLabel(a.severity)}</span>
								{#if (a.sendCount ?? 1) > 1}
									<span class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-text-3">{a.sendCount}×</span>
								{/if}
							</div>
							<p class="mt-1.5 text-[12.5px] font-bold leading-snug text-text-1">{a.title}</p>
							{#if a.detail}
								<p class="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-text-3">{a.detail}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else if section === 'goals'}
			{#if goals.length === 0}
				<div class="flex h-full flex-col items-center justify-center px-4 text-center">
					<div class="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-3">
						<Target size={20} />
					</div>
					<p class="text-[13px] font-semibold text-text-1">Henüz hedef yok</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2.5">
					{#each goals as g (g.goal.goalId)}
						{@const tone = goalTone(g)}
						<div class="rounded-xl border border-border bg-surface-1 p-3">
							<div class="flex items-center justify-between gap-2">
								<span class="truncate text-[12.5px] font-bold text-text-1">{g.goal.label ?? g.goal.metricPath}</span>
								<span class="flex-none rounded-full px-2 py-0.5 text-[9px] font-bold uppercase {tone.cls}">{tone.label}</span>
							</div>
							<div class="mt-2 flex items-baseline gap-1.5">
								<span class="text-[17px] font-extrabold text-text-1">{fmt(g.progress?.now)}</span>
								<span class="text-[12px] text-text-3">→ {g.goal.target}</span>
								{#if g.progress?.weeklyDelta != null && g.progress.weeklyDelta !== 0}
									<span class="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold {g.progress.trend === 'improving' ? 'text-success' : g.progress.trend === 'worsening' ? 'text-danger' : 'text-text-3'}">
										{#if g.progress.weeklyDelta > 0}<TrendingUp size={12} />{:else}<TrendingDown size={12} />{/if}
										{fmt(Math.abs(g.progress.weeklyDelta))}/hafta
									</span>
								{/if}
							</div>
							{#if g.feasibility?.evidence}
								<p class="mt-1.5 text-[11px] leading-relaxed text-text-3">{g.feasibility.evidence}</p>
							{/if}
							{#if g.goal.deadline}
								<p class="mt-1 text-[10px] text-text-3">son tarih {g.goal.deadline}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Sohbet — passive until A1 (K6): the space is claimed, the promise visible. -->
			<div class="flex h-full flex-col items-center justify-center px-6 text-center">
				<div class="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-3">
					<Sparkles size={20} />
				</div>
				<p class="text-[13px] font-semibold text-text-1">Asistan yakında</p>
				<p class="mt-1.5 text-[12px] leading-relaxed text-text-3">
					Gündemi, uyarıları ve hedefleri konuşabileceğiniz asistan bu alana bağlanacak.
				</p>
			</div>
		{/if}
	</div>

	<!-- Composer: visible but passive (K6 — "disabled input + yakında"). -->
	<div class="border-t border-border p-3">
		<div class="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 opacity-60">
			<textarea
				rows="1"
				disabled
				placeholder="Sor… (yakında)"
				class="max-h-20 flex-1 resize-none bg-transparent text-[13px] leading-snug text-text-1 outline-none placeholder:text-text-3"
			></textarea>
			<button disabled class="grid h-8 w-8 flex-none cursor-not-allowed place-items-center rounded-lg bg-talkwo/40 text-white" title="Yakında">
				<ArrowUp size={16} />
			</button>
		</div>
	</div>
{:else}
	<!-- Thread tabs (horizontal, scrollable) -->
	<div class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-surface-2/40 px-3 py-2.5 [scrollbar-width:none]">
		{#each MOCK_THREADS as t (t.id)}
			<button
				onclick={() => (active = t.id)}
				class="inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition-colors
					{active === t.id
					? 'border-text-1 bg-text-1 text-white'
					: 'border-border bg-surface-1 text-text-2 hover:border-text-3 hover:text-text-1'}"
			>
				{t.label}
				{#if t.badge}
					<span class="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{t.badge}</span>
				{/if}
			</button>
		{/each}
		<button class="flex-none rounded-full p-1.5 text-text-3 hover:bg-surface-2" title="Yeni konu">
			<Plus size={15} />
		</button>
	</div>

	<!-- Daily brief -->
	<div class="m-3 mb-1 rounded-2xl border border-talkwo/20 bg-talkwo/5 p-3.5">
		<div class="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-talkwo">
			<Sparkles size={13} />{MOCK_BRIEF.title}
		</div>
		<p class="text-[12.5px] leading-relaxed text-text-1">{MOCK_BRIEF.body}</p>
	</div>

	<!-- Stream -->
	<div class="flex-1 overflow-y-auto p-3 [scrollbar-width:none]">
		<div class="mb-2 mt-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-3">
			Aktif konular · {MOCK_STREAM.length}
		</div>
		<div class="flex flex-col gap-2.5">
			{#each MOCK_STREAM as s (s.id)}
				<button class="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
					<span class="grid h-7 w-7 flex-none place-items-center rounded-lg text-[10px] font-extrabold text-white" style="background:{s.tagColor}">{s.tag}</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-1.5 text-[12.5px] font-bold text-text-1">
							{s.title}
							<span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase {statusChip[s.status]}">{s.statusLabel}</span>
						</span>
						<span class="mt-0.5 block truncate text-[11px] text-text-3">{s.sub}</span>
					</span>
					<span class="flex-none text-right">
						<span class="block text-[13px] font-extrabold {valueTone[s.valueTone]}">{s.value}</span>
						<span class="block text-[10px] text-text-3">{s.valueLabel}</span>
					</span>
				</button>
			{/each}
		</div>

		<!-- Cross-platform insight -->
		<div class="mt-3 px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-3">Çapraz-platform içgörü</div>
		<div class="mt-2 rounded-xl border border-success/30 bg-surface-1 p-3">
			<div class="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-success">
				<GitCompare size={13} />sadece genelde görünür
			</div>
			<!-- Cross-channel insight. Numbers match what the platform lens actually shows
			     (Resepsiyon: HolidayCheck 90.9 vs Google 66.9) — an invented example here
			     would contradict the table two clicks away. -->
			<p class="text-[12px] leading-relaxed text-text-1">
				<b>Resepsiyon</b> HolidayCheck'te çok iyi (90.9) ama Google'da en zayıf kategoriniz (66.9)
				— 24 puanlık fark. Google'a yazanlar check-in kuyruğundan şikâyetçi; asıl kaldıraç orada.
			</p>
		</div>
	</div>

	<!-- Composer -->
	<div class="border-t border-border p-3">
		<div class="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 focus-within:bg-surface-1">
			<textarea
				bind:value={composer}
				rows="1"
				placeholder="Sor…"
				class="max-h-20 flex-1 resize-none bg-transparent text-[13px] leading-snug text-text-1 outline-none placeholder:text-text-3"
			></textarea>
			<button class="grid h-8 w-8 flex-none place-items-center rounded-lg bg-talkwo text-white transition-opacity hover:opacity-90" title="Gönder">
				<ArrowUp size={16} />
			</button>
		</div>
		<p class="mt-1.5 px-0.5 text-[10px] text-text-3">A1'de radar beynine bağlanacak · şu an önizleme</p>
	</div>
{/if}
</div>
