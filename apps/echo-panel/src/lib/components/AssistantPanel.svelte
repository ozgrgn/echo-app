<!--
  AssistantPanel — the right-column assistant shell (ECHO_OS_PLAN.md A1 target).
  In B2 this renders a believable skeleton from mock content; A1 binds it to the
  radar federated brain (SSE stream + tools). Structure mirrors the prototype:
  scope header · thread tabs · daily brief · stream of active topics · composer.
-->
<script lang="ts">
	import { Sparkles, Ellipsis, Plus, ArrowUp, GitCompare, Bell, BellOff, Target, MessagesSquare, ListTodo, TrendingDown, TrendingUp, Minus, Pencil, Trash2 } from '@lucide/svelte';
	import { osState } from '$lib/stores/osState.svelte';
	import { MOCK_THREADS, MOCK_BRIEF, MOCK_STREAM, type ThreadStatus } from '$lib/mock/assistant';
	import TalkwoMark from './TalkwoMark.svelte';
	import AssistantChat from './AssistantChat.svelte';

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
		subject?: string;
		payload?: Record<string, unknown> | null;
		title?: string;
		detail?: string;
		severity?: string;
		category?: string;
		categoryLabel?: string;
		sendCount?: number;
		lastSentAt?: string;
		/** Radar presentation contract: false → action_required card, no LLM analysis. */
		analysisEnabled?: boolean;
	};
	type GoalReport = {
		goal: { goalId: string; label?: string; metricPath: string; target: number; deadline?: string | null };
		progress?: { now: number | null; gap: number | null; weeklyDelta: number | null; trend: string; reached: boolean };
		feasibility?: { verdict: string; verdictTr?: string; evidence?: string };
		pace?: {
			verdict: string;
			sentence: string;
			daysLeft?: number;
			suggestedTarget?: number | null;
			suggestedDeadline?: string | null;
		} | null;
	};
	// Radar returns lean Mongo docs: the id arrives as `_id` (no threadId field).
	type Thread = { threadId?: string; _id?: string; title?: string; source?: string; status?: string };
	const threadIdOf = (t: Thread | null | undefined) => t?.threadId ?? t?._id ?? null;

	type SectionKey = 'agenda' | 'alerts' | 'goals' | 'chat';
	let section = $state<SectionKey>('agenda');
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let alerts = $state<AlertCard[]>([]);
	let goals = $state<GoalReport[]>([]);
	let threads = $state<Thread[]>([]);

	// ── A1: live chat/threads. chatEnabled comes from the proxy (OTP sessions only —
	// radar threads are per-user; clientSecret/demo sessions stay read-only, G6).
	let chatEnabled = $state(false);
	type OpenThread = {
		threadId: string;
		title?: string;
		analyzeInstruction?: string | null;
		followUps?: { label: string; content: string }[];
		/** Auto-sent first turn (e.g. "?" → explainEchoMetric forceTool). */
		initialForce?: {
			content: string;
			displayContent?: string;
			forceTool?: { name: string; args?: Record<string, unknown> };
		};
	};
	let openThread = $state<OpenThread | null>(null);
	let threadBusy = $state(false);

	async function refreshThreads() {
		try {
			const res = await fetch('/api/agenda?resource=threads');
			if (res.ok) threads = (await res.json()).threads ?? [];
		} catch {
			/* list refresh is best-effort */
		}
	}

	/** Alert detail → "Analiz et": open (or continue) the alert's thread and jump in. */
	async function analyzeAlert(a: AlertCard) {
		if (threadBusy) return;
		threadBusy = true;
		try {
			const res = await fetch('/api/agenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'threadFromAlert', fingerprint: a.fingerprint })
			});
			if (!res.ok) throw new Error(`analiz ${res.status}`);
			const data = await res.json();
			const tid = threadIdOf(data.thread);
			if (!tid) throw new Error('threadId yok');
			openThread = {
				threadId: tid,
				title: data.thread?.title ?? a.title,
				analyzeInstruction: data.analyzeInstruction ?? null,
				followUps: data.followUps ?? []
			};
			alertDetail = null;
			void refreshThreads();
		} catch {
			loadError = 'Analiz konusu açılamadı';
		} finally {
			threadBusy = false;
		}
	}

	// "?" popover → "Asistana sor" handoff: open a thread and fire the
	// explainEchoMetric forceTool with the widget's context (G5 Faz 1).
	$effect(() => {
		const req = osState.askMetric;
		if (!req || demo) return;
		osState.clearAskMetric();
		section = 'chat';
		if (!chatEnabled) return; // OTP notice renders in the chat section
		void (async () => {
			if (threadBusy) return;
			threadBusy = true;
			try {
				const res = await fetch('/api/agenda', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'newThread', title: `Nasıl hesaplanır? · ${req.metricId}` })
				});
				if (!res.ok) throw new Error(`thread ${res.status}`);
				const data = await res.json();
				const tid = threadIdOf(data.thread);
				if (!tid) throw new Error('threadId yok');
				openThread = {
					threadId: tid,
					title: data.thread?.title ?? 'Nasıl hesaplanır?',
					initialForce: {
						content: `${req.metricId} metriğinin ne olduğunu ve nasıl hesaplandığını açıkla.`,
						displayContent: 'Nasıl hesaplanır?',
						forceTool: { name: 'explainEchoMetric', args: { ...req } }
					}
				};
				void refreshThreads();
			} catch {
				loadError = 'Asistan konusu açılamadı';
			} finally {
				threadBusy = false;
			}
		})();
	});

	/** Sohbet → "Yeni sohbet": create a manual thread and open it. */
	async function newChat() {
		if (threadBusy) return;
		threadBusy = true;
		try {
			const res = await fetch('/api/agenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'newThread' })
			});
			if (!res.ok) throw new Error(`sohbet ${res.status}`);
			const data = await res.json();
			const tid = threadIdOf(data.thread);
			if (!tid) throw new Error('threadId yok');
			openThread = { threadId: tid, title: data.thread?.title ?? 'Yeni sohbet' };
			void refreshThreads();
		} catch {
			loadError = 'Sohbet açılamadı';
		} finally {
			threadBusy = false;
		}
	}

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
				chatEnabled = !!data.chatEnabled;
				// Label maps for render-time repair — fetch as soon as the list needs them
				// (not only on detail open): echo label_tr for granular keys, echo dept
				// labels for department tokens.
				if (alerts.some((a) => /\.keys:/.test(String(a.subject ?? '')))) void ensureKeyLabels();
				if (alerts.some((a) => /^reviews\.departments/.test(String(a.subject ?? '')))) void ensureDeptOpts();
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

	// ── "Yeni hedef" formu (P2). Metrik seçenekleri EK B'nin hedef haritası — proxy'nin
	// beyaz listesiyle birebir; form başka path üretemez.
	const METRIC_KINDS = [
		{ kind: 'gpi', label: 'Genel GPI', unit: '0-100', min: 0, max: 100 },
		{ kind: 'rpi', label: 'RPI (rakip kıyası)', unit: '100 = parite', min: 0, max: 200 },
		{ kind: 'dept', label: 'Departman GPI', unit: '0-100', min: 0, max: 100 },
		{ kind: 'platformRating', label: 'Platform puanı', unit: '1-5', min: 1, max: 5 },
		{ kind: 'platformGpi', label: 'Platform GPI', unit: '0-100', min: 0, max: 100 },
		{ kind: 'responseRate', label: 'Yorumlara yanıt oranı', unit: '%0-100', min: 0, max: 100 },
		{ kind: 'avgStarRating', label: 'Ortalama yıldız', unit: '1-5', min: 1, max: 5 }
	] as const;
	type MetricKind = (typeof METRIC_KINDS)[number]['kind'];
	const PLATFORMS: [string, string][] = [
		['booking', 'Booking'],
		['tripadvisor', 'TripAdvisor'],
		['google', 'Google'],
		['holidaycheck', 'HolidayCheck']
	];

	let showGoalForm = $state(false);
	let gKind = $state<MetricKind>('gpi');
	let gDept = $state('');
	let gPlatform = $state('booking');
	let gTarget = $state('');
	let gDeadline = $state('');
	let gSaving = $state(false);
	let gError = $state<string | null>(null);
	// Venue's REAL departments (own keys + labels + current score) from the existing
	// echo proxy — the picker shows "Teknik — şu an 24.6" so the target is set in context.
	let deptOpts = $state<{ key: string; label: string; score?: number }[]>([]);

	// Next season end for the "Sezon sonu" preset: seasons are year-agnostic windows
	// (scoring/seasons.ts), so project each window's end month/day onto this year and
	// the next, and take the nearest date that is still ahead of us.
	let seasonEnd = $state<string | null>(null);

	const isoLocal = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

	function nextSeasonEnd(seasons: { start?: string; end?: string }[]): string | null {
		const today = isoLocal(new Date());
		const year = new Date().getFullYear();
		let best: string | null = null;
		for (const s of seasons) {
			const m = /^\d{4}-(\d{2}-\d{2})$/.exec(s.end ?? '');
			if (!m) continue;
			for (const y of [year, year + 1]) {
				const cand = `${y}-${m[1]}`;
				if (cand >= today && (!best || cand < best)) best = cand;
			}
		}
		return best;
	}

	async function ensureDeptOpts() {
		if (deptOpts.length) return;
		try {
			const res = await fetch('/api/os/data?resource=departments');
			const data = await res.json();
			const list = Array.isArray(data) ? data : (data.departments ?? []);
			deptOpts = list.map((d: { key: string; label: string; score?: number }) => ({
				key: d.key,
				label: d.label,
				score: d.score
			}));
			if (deptOpts.length && !gDept) gDept = deptOpts[0].key;
		} catch {
			/* dept picker degrades to empty — other metric kinds still work */
		}
	}

	async function openGoalForm() {
		showGoalForm = true;
		gError = null;
		await ensureDeptOpts();
		if (seasonEnd == null) {
			try {
				const res = await fetch('/api/os/data?resource=venueSettings');
				const data = await res.json();
				seasonEnd = nextSeasonEnd(data.operatingSeasons ?? []);
			} catch {
				/* no season data → the preset simply doesn't render */
			}
		}
	}

	// Deadline presets — one tap instead of date-picker gymnastics.
	function presetDeadline(kind: '30d' | 'nextMonth' | 'season' | 'yearEnd') {
		const now = new Date();
		if (kind === '30d') gDeadline = isoLocal(new Date(now.getTime() + 30 * 86_400_000));
		else if (kind === 'nextMonth')
			gDeadline = isoLocal(new Date(now.getFullYear(), now.getMonth() + 2, 0)); // last day of NEXT month
		else if (kind === 'season' && seasonEnd) gDeadline = seasonEnd;
		else if (kind === 'yearEnd') gDeadline = `${now.getFullYear()}-12-31`;
	}

	const goalDraft = $derived.by(() => {
		const p = PLATFORMS.find(([k]) => k === gPlatform) ?? PLATFORMS[0];
		const d = deptOpts.find((x) => x.key === gDept);
		switch (gKind) {
			case 'gpi':
				return { metricPath: 'reviews.gpi', label: 'Genel GPI' };
			case 'rpi':
				return { metricPath: 'reviews.rpi', label: 'Rakip konumu (RPI)' };
			case 'dept':
				return d
					? { metricPath: `reviews.departments.${d.key}.gpi`, label: `${d.label} GPI` }
					: null;
			case 'platformRating':
				return { metricPath: `reviews.platforms.${p[0]}.rating`, label: `${p[1]} puanı` };
			case 'platformGpi':
				return { metricPath: `reviews.platforms.${p[0]}.gpi`, label: `${p[1]} GPI` };
			case 'responseRate':
				return { metricPath: 'reviews.responseRate', label: 'Yorumlara yanıt oranı' };
			case 'avgStarRating':
				return { metricPath: 'reviews.avgStarRating', label: 'Ortalama yıldız' };
		}
	});
	const gUnit = $derived(METRIC_KINDS.find((m) => m.kind === gKind)?.unit ?? '');

	// Two-step save (owner ask, 2026-07-16/17): Değerlendir fetches a DRY-RUN report and
	// the assessment renders INLINE below the form (no modal — owner, 2026-07-17); the
	// suggestion chips apply the fix and re-assess. Only "Onayla ve kaydet" persists.
	let gPreview = $state<GoalReport | null>(null);

	// One-tap fixes from the assessment: apply, then immediately re-assess so the user
	// sees the verdict flip (unrealistic → demanding/comfortable) before confirming.
	function applySuggestion(kind: 'target' | 'deadline') {
		const p = gPreview?.pace;
		if (!p) return;
		if (kind === 'target' && p.suggestedTarget != null) gTarget = String(p.suggestedTarget);
		if (kind === 'deadline' && p.suggestedDeadline) gDeadline = p.suggestedDeadline;
		void previewGoal();
	}

	// Edit: prefill the form from an existing goal (reverse-map metricPath → picker
	// state) and enter the form view; save is the same upsert path, so "düzenle" and
	// "yeni" are one flow with one assessment.
	function editGoal(g: GoalReport) {
		const mp = g.goal.metricPath;
		let m: RegExpExecArray | null = null;
		if (mp === 'reviews.gpi') gKind = 'gpi';
		else if (mp === 'reviews.rpi') gKind = 'rpi';
		else if (mp === 'reviews.responseRate') gKind = 'responseRate';
		else if (mp === 'reviews.avgStarRating') gKind = 'avgStarRating';
		else if ((m = /^reviews\.departments\.([a-z0-9_]+)\.gpi$/.exec(mp))) {
			gKind = 'dept';
			gDept = m[1];
		} else if ((m = /^reviews\.platforms\.([a-z0-9_]+)\.(rating|gpi)$/.exec(mp))) {
			gKind = m[2] === 'rating' ? 'platformRating' : 'platformGpi';
			gPlatform = m[1];
		}
		gTarget = String(g.goal.target);
		gDeadline = g.goal.deadline ?? '';
		gPreview = null;
		void openGoalForm().then(() => {
			// A goal may point at a department the picker list doesn't carry (renamed /
			// zero-mention dept) — keep it selectable rather than silently switching.
			if (gKind === 'dept' && gDept && !deptOpts.some((d) => d.key === gDept))
				deptOpts = [...deptOpts, { key: gDept, label: gDept }];
		});
	}

	// Delete: two-step arm-then-confirm on the card itself (no browser confirm popup);
	// arming auto-clears after 3s so a stray tap can't linger as a loaded gun.
	let deleteArmed = $state<string | null>(null);
	async function deleteGoal(g: GoalReport) {
		const id = g.goal.goalId;
		if (deleteArmed !== id) {
			deleteArmed = id;
			setTimeout(() => {
				if (deleteArmed === id) deleteArmed = null;
			}, 3000);
			return;
		}
		deleteArmed = null;
		try {
			const res = await fetch('/api/agenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'deleteGoal', goalId: id })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			goals = goals.filter((x) => x.goal.goalId !== id);
		} catch {
			loadError = 'Hedef silinemedi';
		}
	}

	// ── Alert DETAIL view (owner, 2026-07-17): tapping a card opens an in-tab detail —
	// Turkish title (granular label_tr from echo's catalog), a friendlier narrative,
	// the numbers behind it, a yearly sparkline, and the actions (mute / hedef belirle).
	let alertDetail = $state<AlertCard | null>(null);
	let keyLabels = $state<Record<string, string> | null>(null);
	let aSeries = $state<{ date: string; value: number }[] | null>(null);
	let aSeriesLoading = $state(false);

	const humanizeKey = (k: string) => {
		const s = k.replace(/_/g, ' ');
		return s.charAt(0).toUpperCase() + s.slice(1);
	};

	// subject formats (radar scan.js): "reviews.departments:mnt" ·
	// "reviews.departments.keys:sec/privacy_disturbance" · plain metric paths.
	function parseSubject(a: AlertCard): { dept?: string; key?: string } {
		const s = String(a.subject ?? '');
		let m: RegExpExecArray | null;
		if ((m = /^reviews\.departments\.keys:([a-z0-9_]+)\/([a-z0-9_]+)$/.exec(s)))
			return { dept: m[1], key: m[2] };
		if ((m = /^reviews\.departments:([a-z0-9_]+)$/.exec(s))) return { dept: m[1] };
		return {};
	}

	// The daily-series path behind an alert (for the chart) — null when no series maps.
	function seriesPathFor(a: AlertCard): string | null {
		const { dept, key } = parseSubject(a);
		if (dept && key) return `reviews.departments.${dept}.keys.${key}.score`;
		if (dept) return `reviews.departments.${dept}.gpi`;
		if (a.ruleId === 'E_gpi_drop') return 'reviews.gpi';
		if (a.ruleId === 'E_rpi_low' || a.ruleId === 'E_rpi_drop') return 'reviews.rpi';
		if (a.ruleId === 'E_response_rate_drop') return 'reviews.responseRate';
		if (a.ruleId === 'E_volume_drop') return 'reviews.count';
		return null;
	}

	const deptLabel = (k?: string) => (k && deptOpts.find((d) => d.key === k)?.label) || k || '';

	// Render-time label repair. Stored alert titles freeze at creation (the scan's
	// dedup skips re-firing cards, so a label fix never reaches old rows) — swap both
	// the humanized-English granular key (echo label_tr) and the stale department
	// token (echo dept label) at render.
	function trText(a: AlertCard, text?: string): string {
		let t = text ?? '';
		const { dept, key } = parseSubject(a);
		if (key && keyLabels?.[key]) t = t.split(humanizeKey(key)).join(keyLabels[key]);
		const lbl = dept && deptOpts.find((d) => d.key === dept)?.label;
		if (lbl) {
			t = t.replace(/^.+?(?= memnuniyeti )/, lbl); // dept title: "qc memnuniyeti…"
			t = t.replace(/^.+?(?= Echo GPI )/, lbl); // dept detail: "qc Echo GPI…"
			if (key) t = t.replace(/^.+?(?= · )/, lbl); // key detail: "qc · …"
		}
		return t;
	}

	// A friendlier one-paragraph narrative than the stored one-liner, built from payload.
	function alertStory(a: AlertCard): string {
		const p = (a.payload ?? {}) as Record<string, number | string>;
		const { dept, key } = parseSubject(a);
		if (dept && key) {
			const label = keyLabels?.[key] ?? humanizeKey(key);
			return `${deptLabel(dept)} departmanında "${label}" konusu ${p.score ?? '?'} puanda — dikkat eşiği ${p.floor ?? '?'}. Bu skor son dönemdeki ${p.mentions ?? '?'} misafir yorumuna dayanıyor; konu düzelmeden departman skoru da toparlanmaz.`;
		}
		if (dept) {
			return `${deptLabel(dept)} departmanının misafir memnuniyeti ${p.gpi ?? p.now ?? '?'} puanda — dikkat eşiği olan ${p.floor ?? '?'}'in altında. Aşağıdaki seyir son bir yılın günlük skoru; hedef koyarak toparlanmayı takibe alabilirsin.`;
		}
		return trText(a, a.detail);
	}

	async function ensureKeyLabels() {
		if (keyLabels) return;
		try {
			const res = await fetch('/api/os/data?resource=granularLabels');
			const data = await res.json();
			keyLabels = data.labels ?? {};
		} catch {
			keyLabels = {};
		}
	}

	async function openAlert(a: AlertCard) {
		alertDetail = a;
		muteOpen = null;
		aSeries = null;
		void ensureDeptOpts();
		void ensureKeyLabels();
		const path = seriesPathFor(a);
		if (!path) return;
		aSeriesLoading = true;
		try {
			const res = await fetch(`/api/agenda?resource=series&path=${encodeURIComponent(path)}&days=365`);
			const data = await res.json();
			aSeries = data.points ?? [];
		} catch {
			aSeries = [];
		} finally {
			aSeriesLoading = false;
		}
	}

	// "Hedef belirle" — jump to the Hedefler tab with the form prefilled from the alert.
	function goalFromAlert(a: AlertCard) {
		const { dept } = parseSubject(a);
		if (dept) {
			gKind = 'dept';
			gDept = dept;
		} else if (a.ruleId === 'E_rpi_low' || a.ruleId === 'E_rpi_drop') gKind = 'rpi';
		else if (a.ruleId === 'E_response_rate_drop') gKind = 'responseRate';
		else gKind = 'gpi';
		gTarget = '';
		gDeadline = '';
		gPreview = null;
		alertDetail = null;
		section = 'goals';
		void openGoalForm().then(() => {
			if (gKind === 'dept' && gDept && !deptOpts.some((d) => d.key === gDept))
				deptOpts = [...deptOpts, { key: gDept, label: gDept }];
		});
	}

	// Sparkline geometry (single series, 2px line, threshold as dashed reference).
	const SPARK_W = 320;
	const SPARK_H = 84;
	const sparkGeo = $derived.by(() => {
		const pts = aSeries ?? [];
		if (pts.length < 2) return null;
		const vals = pts.map((p) => p.value);
		const floorRaw = (alertDetail?.payload as Record<string, unknown> | null)?.floor;
		const floor = typeof floorRaw === 'number' ? floorRaw : null;
		const lo = Math.min(...vals, ...(floor != null ? [floor] : []));
		const hi = Math.max(...vals, ...(floor != null ? [floor] : []));
		const span = hi - lo || 1;
		const x = (i: number) => (i / (pts.length - 1)) * SPARK_W;
		const y = (v: number) => SPARK_H - 6 - ((v - lo) / span) * (SPARK_H - 12);
		return {
			d: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '),
			floorY: floor != null ? y(floor) : null,
			floor,
			lo: Math.round(lo * 10) / 10,
			hi: Math.round(hi * 10) / 10,
			last: pts[pts.length - 1],
			lastX: x(pts.length - 1),
			lastY: y(pts[pts.length - 1].value),
			from: pts[0].date,
			to: pts[pts.length - 1].date
		};
	});

	// Mute an alert (P3, radar preset contract: 7d | 30d | forever). The card leaves
	// the active list on success — radar's lifecycle keeps the fingerprint, so the
	// alert resurfaces cleanly when the mute expires.
	let muteOpen = $state<string | null>(null); // fingerprint whose preset menu is open
	async function muteAlert(fingerprint: string, preset: '7d' | '30d' | 'forever') {
		muteOpen = null;
		try {
			const res = await fetch('/api/agenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'muteAlert', fingerprint, preset })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			alerts = alerts.filter((a) => a.fingerprint !== fingerprint);
			if (alertDetail?.fingerprint === fingerprint) alertDetail = null;
		} catch {
			loadError = 'Uyarı susturulamadı';
		}
	}

	// Generic date-extension chips on the assessment itself (owner, 2026-07-17):
	// bump the deadline and re-assess in one tap — the verdict recomputes with the
	// new window, no trip back up to the form.
	function extendAndAssess(kind: Parameters<typeof presetDeadline>[0]) {
		presetDeadline(kind);
		void previewGoal();
	}

	// The date input's ELEMENT, not just its value: a hand-typed impossible date
	// ("31/09/2026") leaves value '' but sets validity.badInput — without checking it
	// the deadline silently vanishes and the preview says "tarih girilmedi".
	let deadlineEl = $state<HTMLInputElement | null>(null);

	function goalPayload() {
		const draft = goalDraft;
		// bind:value on a type="number" input yields a NUMBER (or '' when empty) — never
		// assume string here; String() first, then accept the Turkish decimal comma.
		const raw = String(gTarget ?? '').trim();
		const target = Number(raw.replace(',', '.'));
		if (!draft) return null;
		if (!raw || !Number.isFinite(target)) {
			gError = 'Hedef değeri gerekli';
			return null;
		}
		const kindMeta = METRIC_KINDS.find((m) => m.kind === gKind);
		if (kindMeta && (target < kindMeta.min || target > kindMeta.max)) {
			gError = `Hedef ${kindMeta.min}–${kindMeta.max} aralığında olmalı (${kindMeta.unit})`;
			return null;
		}
		if (deadlineEl?.validity.badInput) {
			gError = 'Geçersiz tarih — gün/ay değerini kontrol et';
			return null;
		}
		return {
			metricPath: draft.metricPath,
			target,
			label: draft.label,
			...(gDeadline ? { deadline: gDeadline } : {})
		};
	}

	async function postGoal(action: 'previewGoal' | 'setGoal'): Promise<GoalReport> {
		const payload = goalPayload();
		if (!payload) throw new Error('form');
		const res = await fetch('/api/agenda', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, ...payload })
		});
		if (!res.ok) {
			const err = await res.json().catch(() => null);
			throw new Error(err?.message ?? `HTTP ${res.status}`);
		}
		return res.json();
	}

	async function previewGoal() {
		if (!goalPayload()) return; // sets gError
		gSaving = true;
		gError = null;
		try {
			gPreview = await postGoal('previewGoal');
		} catch (e) {
			if (!(e instanceof Error && e.message === 'form'))
				gError = e instanceof Error ? e.message : 'Önizleme alınamadı';
		} finally {
			gSaving = false;
		}
	}

	async function confirmGoal() {
		gSaving = true;
		try {
			const report = await postGoal('setGoal');
			// Upsert semantics mirror radar's goalStore.set: same metric → same goal.
			goals = [report, ...goals.filter((g) => g.goal.metricPath !== report.goal.metricPath)];
			gPreview = null;
			showGoalForm = false;
			gTarget = '';
			gDeadline = '';
		} catch (e) {
			gPreview = null;
			gError = e instanceof Error ? e.message : 'Hedef kaydedilemedi';
		} finally {
			gSaving = false;
		}
	}

	// Modal tone follows the pace verdict — the calendar's answer colors the confirm.
	const paceTone = (v?: string) =>
		v === 'comfortable' || v === 'reached'
			? 'text-success'
			: v === 'demanding'
				? 'text-warning'
				: v === 'unrealistic' || v === 'past_deadline'
					? 'text-danger'
					: 'text-text-2';
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

	<div class="flex-1 {openThread ? 'overflow-hidden' : 'overflow-y-auto'} p-3 [scrollbar-width:none]">
		{#if openThread}
			<!-- A1: an open assist thread takes over the content area (all sections route here). -->
			<AssistantChat
				threadId={openThread.threadId}
				title={openThread.title}
				analyzeInstruction={openThread.analyzeInstruction ?? null}
				followUps={openThread.followUps ?? []}
				initialForce={openThread.initialForce}
				onback={() => {
					openThread = null;
					void refreshThreads();
				}}
			/>
		{:else if loading}
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
					{#each threads as t (threadIdOf(t) ?? t.title)}
						<button
							disabled={!chatEnabled || !threadIdOf(t)}
							onclick={() => {
								const tid = threadIdOf(t);
								if (tid) openThread = { threadId: tid, title: t.title };
							}}
							class="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none"
						>
							<span class="grid h-7 w-7 flex-none place-items-center rounded-lg bg-talkwo/10 text-talkwo">
								<MessagesSquare size={14} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[12.5px] font-bold text-text-1">{t.title ?? 'Konu'}</span>
								<span class="mt-0.5 block text-[11px] text-text-3">{t.source === 'alert' ? 'uyarıdan' : t.source === 'goal' ? 'hedeften' : 'sohbet'}</span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		{:else if section === 'alerts'}
			{#if alertDetail}
				{@const a = alertDetail}
				<!-- ── Alert detail: narrative + numbers + yearly line + actions ── -->
				<button onclick={() => (alertDetail = null)} class="mb-2 text-[11px] font-semibold text-text-3 hover:text-text-1">← Uyarılara dön</button>
				<div class="rounded-xl border border-border bg-surface-1 p-3.5 {a.severity === 'critical' ? 'border-l-2 border-l-danger' : ''}">
					<div class="flex items-center gap-2">
						<span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase {sevChip(a.severity)}">{sevLabel(a.severity)}</span>
						{#if (a.sendCount ?? 1) > 1}
							<span class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-text-3">{a.sendCount}× tetiklendi</span>
						{/if}
					</div>
					<p class="mt-2 text-[13.5px] font-bold leading-snug text-text-1">{trText(a, a.title)}</p>
					<p class="mt-2 text-[12px] leading-relaxed text-text-2">{alertStory(a)}</p>

					{#if aSeriesLoading}
						<!-- Chart data still loading: keep the chart-height box but show three
						     sequentially-pulsing dots instead of drawing an empty/placeholder line. -->
						<div class="mt-3 flex h-[84px] items-center justify-center gap-1.5 rounded-lg bg-surface-2" role="status" aria-label="Grafik yükleniyor">
							<span class="spark-dot h-2 w-2 rounded-full bg-text-3"></span>
							<span class="spark-dot h-2 w-2 rounded-full bg-text-3"></span>
							<span class="spark-dot h-2 w-2 rounded-full bg-text-3"></span>
						</div>
					{:else if aSeries && aSeries.length > 0 && aSeries.length < 14}
						<!-- A 2-point "line" reads as "always flat" — say what's true instead. -->
						<div class="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11.5px] leading-relaxed text-text-3">
							Bu metrik için henüz <b class="text-text-1">{aSeries.length} günlük</b> veri var (son değer
							<b class="text-text-1">{fmt(aSeries[aSeries.length - 1].value)}</b>) — grafik veri biriktikçe anlamlanacak.
						</div>
					{:else if sparkGeo}
						<!-- Yearly daily series — single line, threshold as dashed reference. -->
						<div class="mt-3 rounded-lg bg-surface-2 p-2.5">
							<svg viewBox="0 0 {SPARK_W} {SPARK_H}" class="block w-full" role="img" aria-label="Son 1 yılın günlük seyri">
								{#if sparkGeo.floorY != null}
									<line x1="0" y1={sparkGeo.floorY} x2={SPARK_W} y2={sparkGeo.floorY} class="stroke-text-3/40" stroke-width="1" stroke-dasharray="4 3" />
								{/if}
								<path d={sparkGeo.d} fill="none" class="stroke-talkwo" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
								<circle cx={sparkGeo.lastX} cy={sparkGeo.lastY} r="3" class="fill-talkwo" />
							</svg>
							<div class="mt-1 flex items-center justify-between text-[10px] text-text-3">
								<span>{sparkGeo.from}</span>
								<span>aralık {sparkGeo.lo}–{sparkGeo.hi}{sparkGeo.floor != null ? ` · eşik ${sparkGeo.floor}` : ''}</span>
								<span>{sparkGeo.to} · <b class="text-text-1">{fmt(sparkGeo.last.value)}</b></span>
							</div>
						</div>
					{/if}

					<div class="mt-3 flex flex-wrap items-center gap-1.5">
						{#if chatEnabled && a.analysisEnabled !== false}
						<!-- A1 (K4): "Analiz et" artık görünür — uyarının thread'ini açar, forced-evidence analiz orada. -->
						<button
							disabled={threadBusy}
							onclick={() => void analyzeAlert(a)}
							class="rounded-lg bg-talkwo px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{threadBusy ? 'Açılıyor…' : 'Analiz et'}
						</button>
					{/if}
					<button onclick={() => goalFromAlert(a)} class="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Hedef belirle</button>
						<span class="ml-auto text-[10px] font-bold uppercase tracking-wide text-text-3">Sustur:</span>
						<button onclick={() => muteAlert(a.fingerprint, '7d')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 hover:border-text-3 hover:text-text-1">7g</button>
						<button onclick={() => muteAlert(a.fingerprint, '30d')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 hover:border-text-3 hover:text-text-1">30g</button>
						<button onclick={() => muteAlert(a.fingerprint, 'forever')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 hover:border-danger hover:text-danger">kalıcı</button>
					</div>
				</div>
			{:else if alerts.length === 0}
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
						<button onclick={() => openAlert(a)} class="rounded-xl border border-border bg-surface-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover {a.severity === 'critical' ? 'border-l-2 border-l-danger' : ''}">
							<div class="flex items-start gap-2">
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase {sevChip(a.severity)}">{sevLabel(a.severity)}</span>
								{#if (a.sendCount ?? 1) > 1}
									<span class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-text-3">{a.sendCount}×</span>
								{/if}
								<span class="ml-auto rounded-md p-0.5 text-text-3"><Ellipsis size={14} /></span>
							</div>
							<p class="mt-1.5 text-[12.5px] font-bold leading-snug text-text-1">{trText(a, a.title)}</p>
							{#if a.detail}
								<p class="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-text-3">{trText(a, a.detail)}</p>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{:else if section === 'goals'}
			{#if !showGoalForm}
				<button
					onclick={openGoalForm}
					class="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-[12px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1"
				>
					<Plus size={14} />Yeni hedef
				</button>
			{:else}
				<div class="mb-2.5 rounded-xl border border-talkwo/30 bg-surface-1 p-3">
					<div class="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-talkwo">Yeni hedef</div>
					<div class="flex flex-col gap-2">
						<select bind:value={gKind} class="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text-1 outline-none">
							{#each METRIC_KINDS as m (m.kind)}
								<option value={m.kind}>{m.label}</option>
							{/each}
						</select>
						{#if gKind === 'dept'}
							<select bind:value={gDept} class="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text-1 outline-none">
								{#each deptOpts as d (d.key)}
									<option value={d.key}>{d.label}{typeof d.score === 'number' ? ` — şu an ${d.score}` : ''}</option>
								{/each}
							</select>
						{:else if gKind === 'platformRating' || gKind === 'platformGpi'}
							<select bind:value={gPlatform} class="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text-1 outline-none">
								{#each PLATFORMS as [key, label] (key)}
									<option value={key}>{label}</option>
								{/each}
							</select>
						{/if}
						<div class="flex items-center gap-2">
							<input
								bind:value={gTarget}
								type="number"
								step="0.1"
								placeholder="Hedef ({gUnit})"
								class="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text-1 outline-none placeholder:text-text-3"
							/>
							<input
								bind:value={gDeadline}
								bind:this={deadlineEl}
								type="date"
								title="Son tarih (opsiyonel)"
								class="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text-1 outline-none"
							/>
						</div>
						<div class="flex flex-wrap items-center gap-1.5">
							<button onclick={() => presetDeadline('30d')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">30 gün</button>
							<button onclick={() => presetDeadline('nextMonth')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Gelecek ay sonu</button>
							{#if seasonEnd}
								<button onclick={() => presetDeadline('season')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Sezon sonu · {seasonEnd.slice(5).replace('-', '/')}</button>
							{/if}
							<button onclick={() => presetDeadline('yearEnd')} class="rounded-full border border-border px-2 py-1 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Yıl sonu</button>
						</div>
						{#if gError}
							<p class="text-[11px] text-danger">{gError}</p>
						{/if}
						<div class="flex justify-end gap-2">
							<button onclick={() => { showGoalForm = false; gPreview = null; }} class="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-text-3 hover:text-text-1">Geri dön</button>
							<button
								onclick={previewGoal}
								disabled={gSaving}
								class="rounded-lg bg-talkwo px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>{gSaving ? 'Hesaplanıyor…' : gPreview ? 'Yeniden değerlendir' : 'Değerlendir'}</button>
						</div>
					</div>
				</div>

				<!-- Inline assessment (no modal — owner, 2026-07-17): the calendar + the
				     review-mass math answer HERE, under the form, before anything saves. -->
				{#if gPreview}
					{@const p = gPreview}
					<div class="mb-2.5 rounded-xl border border-border bg-surface-1 p-3">
						<div class="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-talkwo">Değerlendirme</div>
						<p class="text-[12.5px] font-bold text-text-1">
							{p.goal.label ?? p.goal.metricPath}: hedef {p.goal.target}{p.goal.deadline ? ` · ${p.goal.deadline}` : ''}
						</p>
						<p class="mt-0.5 text-[11.5px] text-text-3">Şu an: <b class="text-text-1">{fmt(p.progress?.now)}</b>{p.progress?.gap != null && p.progress.gap > 0 ? ` — fark ${fmt(p.progress.gap)}` : ''}</p>
						{#if p.pace?.sentence}
							<p class="mt-2 rounded-lg bg-surface-2 p-2.5 text-[12px] leading-relaxed {paceTone(p.pace.verdict)}">{p.pace.sentence}</p>
						{:else if p.feasibility?.evidence}
							<p class="mt-2 rounded-lg bg-surface-2 p-2.5 text-[12px] leading-relaxed text-text-2">{p.feasibility.evidence}</p>
						{/if}
						{#if !p.goal.deadline}
							<p class="mt-1.5 text-[11px] text-text-3">Son tarih girilmedi — tarih girersen süre + yorum-akışı değerlendirmesi de yapılır.</p>
						{/if}
						{#if p.pace?.suggestedDeadline || p.pace?.suggestedTarget != null}
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#if p.pace?.suggestedTarget != null}
									<button onclick={() => applySuggestion('target')} class="rounded-full border border-talkwo/40 bg-talkwo/5 px-2.5 py-1 text-[11px] font-semibold text-talkwo transition-colors hover:bg-talkwo/10">Hedefi {p.pace.suggestedTarget} yap</button>
								{/if}
								{#if p.pace?.suggestedDeadline}
									<button onclick={() => applySuggestion('deadline')} class="rounded-full border border-talkwo/40 bg-talkwo/5 px-2.5 py-1 text-[11px] font-semibold text-talkwo transition-colors hover:bg-talkwo/10">Tarihi {p.pace.suggestedDeadline} yap</button>
								{/if}
							</div>
						{/if}
						{#if p.pace && p.pace.verdict !== 'comfortable' && p.pace.verdict !== 'reached'}
							<!-- Always-available window bumps: re-assess with a longer runway in one tap. -->
							<div class="mt-2 flex flex-wrap items-center gap-1.5">
								<span class="text-[10px] font-bold uppercase tracking-wide text-text-3">Süreyi değiştir:</span>
								<button onclick={() => extendAndAssess('30d')} class="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">+30 gün</button>
								<button onclick={() => extendAndAssess('nextMonth')} class="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Gelecek ay sonu</button>
								{#if seasonEnd}
									<button onclick={() => extendAndAssess('season')} class="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Sezon sonu</button>
								{/if}
								<button onclick={() => extendAndAssess('yearEnd')} class="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1">Yıl sonu</button>
							</div>
						{/if}
						<div class="mt-3 flex justify-end">
							<button
								onclick={confirmGoal}
								disabled={gSaving}
								class="rounded-lg bg-talkwo px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>{gSaving ? 'Kaydediliyor…' : 'Onayla ve kaydet'}</button>
						</div>
					</div>
				{/if}
			{/if}
			{#if goals.length === 0 && !showGoalForm}
				<div class="flex flex-col items-center justify-center px-4 py-14 text-center">
					<div class="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-3">
						<Target size={20} />
					</div>
					<p class="text-[13px] font-semibold text-text-1">Henüz hedef yok</p>
					<p class="mt-1.5 text-[12px] text-text-3">"Yeni hedef" ile ilk hedefini koy — gidişatı her sabah taze veriyle izleriz.</p>
				</div>
			{:else if !showGoalForm}
				<div class="flex flex-col gap-2.5">
					{#each goals as g (g.goal.goalId)}
						{@const tone = goalTone(g)}
						<div class="group rounded-xl border border-border bg-surface-1 p-3">
							<div class="flex items-center justify-between gap-2">
								<span class="truncate text-[12.5px] font-bold text-text-1">{g.goal.label ?? g.goal.metricPath}</span>
								<span class="flex flex-none items-center gap-1">
									{#if deleteArmed === g.goal.goalId}
										<button onclick={() => deleteGoal(g)} class="rounded-full bg-danger px-2 py-0.5 text-[9px] font-bold uppercase text-white">Emin misin?</button>
									{:else}
										<button onclick={() => editGoal(g)} title="Düzenle" class="rounded-md p-1 text-text-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-text-1 group-hover:opacity-100"><Pencil size={12} /></button>
										<button onclick={() => deleteGoal(g)} title="Sil" class="rounded-md p-1 text-text-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100"><Trash2 size={12} /></button>
									{/if}
									<span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase {tone.cls}">{tone.label}</span>
								</span>
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
		{:else if !chatEnabled}
			<!-- Chat needs a per-user identity (radar threads are per-user, G6) — OTP girişi şart.
			     Legacy clientSecret + demo oturumları bu yüzden okur ama konuşamaz. -->
			<div class="flex h-full flex-col items-center justify-center px-6 text-center">
				<div class="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-3">
					<Sparkles size={20} />
				</div>
				<p class="text-[13px] font-semibold text-text-1">Asistan OTP girişiyle açılır</p>
				<p class="mt-1.5 text-[12px] leading-relaxed text-text-3">
					Sohbetler kişiye özeldir. Telefonla (OTP) giriş yaptığınızda asistan burada aktif olur.
				</p>
			</div>
		{:else}
			<!-- Sohbet (A1): manuel konular + yeni sohbet. Uyarı/hedef konuları Gündem'de. -->
			<div class="flex flex-col gap-2.5">
				<button
					disabled={threadBusy}
					onclick={() => void newChat()}
					class="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-[12.5px] font-semibold text-text-2 transition-colors hover:border-text-3 hover:text-text-1 disabled:opacity-50"
				>
					<Plus size={15} />{threadBusy ? 'Açılıyor…' : 'Yeni sohbet'}
				</button>
				{#each threads.filter((t) => t.source === 'manual') as t (threadIdOf(t) ?? t.title)}
					<button
						onclick={() => {
							const tid = threadIdOf(t);
							if (tid) openThread = { threadId: tid, title: t.title };
						}}
						class="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
					>
						<span class="grid h-7 w-7 flex-none place-items-center rounded-lg bg-talkwo/10 text-talkwo">
							<MessagesSquare size={14} />
						</span>
						<span class="min-w-0 flex-1 truncate text-[12.5px] font-bold text-text-1">{t.title ?? 'Sohbet'}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if !chatEnabled && !openThread}
		<!-- Composer: passive placeholder for identity-less sessions (OTP unlocks chat). -->
		<div class="border-t border-border p-3">
			<div class="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 opacity-60">
				<textarea
					rows="1"
					disabled
					placeholder="Sor… (OTP girişiyle)"
					class="max-h-20 flex-1 resize-none bg-transparent text-[13px] leading-snug text-text-1 outline-none placeholder:text-text-3"
				></textarea>
				<button disabled class="grid h-8 w-8 flex-none cursor-not-allowed place-items-center rounded-lg bg-talkwo/40 text-white" title="OTP girişiyle">
					<ArrowUp size={16} />
				</button>
			</div>
		</div>
	{/if}
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

<style>
	/* Alert mini-chart loading placeholder: three dots pulse in sequence (left→right)
	   so the wait reads as a lively "…" rather than a frozen block. */
	.spark-dot {
		animation: spark-dot-pulse 1.1s ease-in-out infinite;
	}
	.spark-dot:nth-child(2) {
		animation-delay: 0.16s;
	}
	.spark-dot:nth-child(3) {
		animation-delay: 0.32s;
	}
	@keyframes spark-dot-pulse {
		0%, 80%, 100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spark-dot {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
