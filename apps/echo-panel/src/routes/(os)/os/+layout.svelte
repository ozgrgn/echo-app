<!--
  ECHO OS shell — the 3-column command center (ECHO_OS_PLAN.md):
    [ rail 58px ] [ canvas (lens views) ] [ assistant 384px ]

  This layout is the parallel /os route — the legacy (app)/dashboard is untouched.
  The rail carries the two global counters (at-risk goals + open alerts) so they're
  reachable from any lens. The assistant column is a placeholder shell in B1; A1
  wires it to the radar federated brain.
-->
<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page, navigating } from '$app/state';
	import { osState } from '$lib/stores/osState.svelte';
	import { Target, Bell, Settings, Sparkles, X } from '@lucide/svelte';
	import { OS_NAV, lensForPath, type OsNavItem } from '$lib/config/osNav';
	import {
		OS_WINDOW_TABS,
		parseOsWindow,
		parseCustomRange,
		hidesCompetitors,
		DEFAULT_OS_WINDOW
	} from '$lib/config/window';
	import AssistantPanel from '$lib/components/AssistantPanel.svelte';
	import TalkwoMark from '$lib/components/TalkwoMark.svelte';
	import LensTabs from '$lib/components/LensTabs.svelte';

	let { children, data } = $props();

	// Rail nav renders from the shared OS_NAV config (single source of truth,
	// mirrored by the in-canvas LensTabs). Lucide icons (single-color, currentColor).
	//
	// Active lens is derived from the URL (lensForPath), NOT osState — the URL is the
	// source of truth. On HMR the in-memory store resets to its default while the URL
	// stays put, which would desync the rail highlight from the actual route.
	const activeKind = $derived(lensForPath(page.url.pathname) ?? osState.lens.kind);

	// These lenses carry their own back button + in-page switcher row, so the
	// global LensTabs would stack a second button row. Hide it on them.
	const hideLensTabs = $derived(
		page.route.id === '/(os)/os/platform/[platform]' ||
			page.route.id === '/(os)/os/departments' ||
			page.route.id === '/(os)/os/department/[dept]'
	);

	// The rail used to carry an M/C badge that flipped the whole OS between a mock
	// dataset and the live backend. There is only one data path now (the backend),
	// so there is nothing to toggle — a demo tenant simply sees fixture data through
	// its own session.

	// Data-driven nav: activate the lens, then navigate to its canonical route.
	// Platform lands on the overview index (/os/platform) — a specific channel is
	// picked from there, so no channel hardcode here anymore.
	function go(item: OsNavItem) {
		osState.setLens({ kind: item.lens });
		goto(item.href);
	}

	// The canvas <main> is its OWN scroll container, and SvelteKit only resets the
	// window's scroll on navigation — so switching lenses mid-scroll used to land
	// the new page at the old scroll offset ("the page continues at the bottom").
	// Reset it on PATH changes only: window/date changes rewrite just the query
	// string and deliberately keep the reading position (their goto passes noScroll).
	let mainEl = $state<HTMLElement>();
	afterNavigate((nav) => {
		if (nav.from?.url.pathname !== nav.to?.url.pathname) mainEl?.scrollTo(0, 0);
		// Any navigation closes the mobile assistant sheet — e.g. tapping a deep link
		// the assistant offered; staying open would hide the very page it opened.
		assistantOpen = false;
	});

	// Mobile assistant sheet: on phones the aside is a full-screen overlay (see the
	// media query) toggled by a floating button above the bottom tab bar. Desktop
	// ignores this entirely — the aside is a fixed grid column there.
	let assistantOpen = $state(false);

	// Global time-window — URL-driven (`?window=`), so every lens's SSR load reads
	// the same horizon and it survives refresh/share. Active window comes from the
	// URL, not client state (SSR must see it).
	const activeWindow = $derived(parseOsWindow(page.url.searchParams.get('window')));
	// G12 custom range: `?window=custom&from&to`. When active, the rail highlights "Özel"
	// instead of a fixed window (parseOsWindow falls back to the default for 'custom', so
	// activeWindow alone would wrongly light up 6A).
	const customRange = $derived(parseCustomRange(page.url.searchParams));

	// Lens entries shared by the desktop rail and the mobile bottom tab bar.
	// 'max' (Tümü) hides competitor comparison → drop the Rakipler entry (owner
	// decision: owned full history isn't comparable to a rival's ~2yr).
	const navTabs = $derived(
		OS_NAV.filter((i) => !(i.lens === 'competitors' && hidesCompetitors(activeWindow)))
	);
	function selectWindow(key: string) {
		if (key === activeWindow && !customRange) return;
		// Preserve the current path + other params; swap only `window`. Drop the param only
		// for the ACTUAL default (6mo) to keep those URLs clean — every other window, incl.
		// 24mo, must be set EXPLICITLY. (Bug fix: this used to delete for 24mo, back when the
		// default was 24mo; the default is now 6mo — DEFAULT_OS_WINDOW — so deleting on 24mo
		// made parseOsWindow read "absent" → fall back to 6mo, i.e. 2Y silently became 6A.)
		// Leaving a custom range also clears its from/to so stale bounds never linger.
		const url = new URL(page.url);
		url.searchParams.delete('from');
		url.searchParams.delete('to');
		if (key === DEFAULT_OS_WINDOW) url.searchParams.delete('window');
		else url.searchParams.set('window', key);
		goto(url.pathname + url.search, { keepFocus: true, noScroll: true, invalidateAll: true });
	}

	// ── "Özel" (custom date range) picker state ──────────────────────────────
	// Two native date inputs in a small popover next to the rail. Apply → URL, so the
	// range is SSR-visible, shareable and refresh-proof like every fixed window.
	let customOpen = $state(false);
	let customFrom = $state('');
	let customTo = $state('');
	const todayIso = () => new Date().toISOString().slice(0, 10);
	function openCustom() {
		// Seed the form: active range if set, else last 30 days — an immediately
		// applicable default beats two empty inputs.
		const to = customRange?.to ?? todayIso();
		const from =
			customRange?.from ?? new Date(Date.parse(to) - 30 * 86_400_000).toISOString().slice(0, 10);
		customFrom = from;
		customTo = to;
		customOpen = !customOpen;
	}
	function applyCustom() {
		if (!customFrom || !customTo || customFrom > customTo) return;
		const url = new URL(page.url);
		url.searchParams.set('window', 'custom');
		url.searchParams.set('from', customFrom);
		url.searchParams.set('to', customTo);
		customOpen = false;
		goto(url.pathname + url.search, { keepFocus: true, noScroll: true, invalidateAll: true });
	}
</script>

<!-- Demo banner. Persistent and unmissable: a viewer must never take these numbers for a
     real property's, and a presenter must never forget which mode they are in. It steals
     32px from the grid, hence the h-[calc(...)] below. -->
{#if data?.session?.isDemo}
	<div
		class="relative flex h-8 items-center justify-center gap-2 bg-talkwo text-xs font-medium text-white"
	>
		<span class="rounded bg-white/20 px-1.5 py-0.5 font-semibold tracking-wide">DEMO</span>
		<span>{data.session.venueName} — anonimleştirilmiş örnek veri</span>
		<!-- Demodan çık: clears the demo session cookies (/logout → clearSession) so the
		     browser returns to the normal echo login instead of being stuck in the demo. -->
		<a
			href="/logout"
			data-sveltekit-reload
			class="absolute right-3 rounded bg-white/20 px-2 py-0.5 font-semibold transition hover:bg-white/30"
			title="Demo oturumunu kapat, normal panele dön"
		>
			Demodan çık
		</a>
	</div>
{/if}

<div
	class="os-shell grid overflow-hidden {data?.session?.isDemo ? 'h-[calc(100vh-2rem)]' : 'h-screen'}"
	style="grid-template-columns: 58px 1fr 384px;"
>
	<!-- ── Rail ──────────────────────────────────────────────────────────── -->
	<nav class="flex flex-col items-center gap-1 border-r border-border bg-surface-1 py-3.5">
		<TalkwoMark size={24} class="mb-3" />

		{#each navTabs as item (item.lens)}
			{@const Icon = item.icon}
			<button
				onclick={() => go(item)}
				title={item.label}
				class="nav-lens grid h-10 w-10 place-items-center rounded-xl transition-colors
					{activeKind === item.lens
					? 'bg-text-1 text-white'
					: 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
			>
				<Icon size={19} strokeWidth={2} />
			</button>
		{/each}

		<!-- Global time-window selector — vertical, centered. Sets ?window= on the URL
		     so every lens reflects the same horizon (2 Yıl = full history, default). -->
		<div class="mt-3 flex flex-col items-center gap-1 border-t border-border pt-3">
			{#each OS_WINDOW_TABS as t (t.key)}
				<!-- In the Rakipler lens, windows that hide competitor comparison ('max')
				     are DISABLED, not just tolerated: selecting Tümü there would silently
				     drop the very lens the user is standing in. Visibly off + a title
				     explaining why beats a click that appears to do something weird. -->
				{@const offInLens = activeKind === 'competitors' && hidesCompetitors(t.key)}
				<button
					onclick={() => selectWindow(t.key)}
					disabled={offInLens}
					title={offInLens
						? 'Rakipler görünümünde kapalı — rakip verisi son 2 yılla sınırlı'
						: `Zaman aralığı: ${t.label}`}
					class="grid h-8 w-9 place-items-center rounded-lg text-[11px] font-bold transition-colors
						disabled:cursor-not-allowed disabled:opacity-35
						{activeWindow === t.key && !customRange
						? 'bg-brand/12 text-brand'
						: 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
				>
					{t.short}
				</button>
			{/each}

			<!-- "Özel" — free date range (G12). Cards read as of the range END (time machine);
			     the popover writes ?window=custom&from&to so SSR sees it like any window. -->
			<div class="relative">
				<button
					onclick={openCustom}
					title={customRange
						? `Özel aralık: ${customRange.from} → ${customRange.to}`
						: 'Özel tarih aralığı'}
					class="grid h-8 w-9 place-items-center rounded-lg text-[10px] font-bold transition-colors
						{customRange ? 'bg-brand/12 text-brand' : 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
				>
					Özel
				</button>
				{#if customOpen}
					<div
						class="custom-pop absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-border bg-surface-1 p-3 shadow-lg"
					>
						<div class="mb-2 text-xs font-semibold text-text-1">Özel tarih aralığı</div>
						<label class="mb-2 block text-[11px] text-text-3">
							Başlangıç
							<input
								type="date"
								bind:value={customFrom}
								max={customTo || todayIso()}
								class="mt-0.5 w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-text-1"
							/>
						</label>
						<label class="mb-3 block text-[11px] text-text-3">
							Bitiş
							<input
								type="date"
								bind:value={customTo}
								min={customFrom}
								max={todayIso()}
								class="mt-0.5 w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-text-1"
							/>
						</label>
						<div class="flex items-center justify-end gap-2">
							<button
								onclick={() => (customOpen = false)}
								class="rounded-lg px-2 py-1 text-[11px] text-text-3 hover:bg-surface-2"
							>
								Vazgeç
							</button>
							<button
								onclick={applyCustom}
								disabled={!customFrom || !customTo || customFrom > customTo}
								class="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
							>
								Uygula
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex-1"></div>

		<!-- Global counters: at-risk goals + open alerts (reachable from any lens).
		     The BADGES are gone. They were demo-only and hardcoded (MOCK_OS_COUNTERS), which
		     was defensible while nothing real existed — but the demo now reads live goals and
		     alerts from radar, so a fixed "3" would contradict the panel one click away. The
		     buttons stay: the shell is real, and the counts return when they can be read from
		     the same source the assistant panel uses rather than invented here. -->
		<button
			title="Hedefler"
			class="relative grid h-10 w-10 place-items-center rounded-xl text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
		>
			<Target size={19} strokeWidth={2} />
		</button>
		<button
			title="Uyarılar"
			class="relative grid h-10 w-10 place-items-center rounded-xl text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
		>
			<Bell size={19} strokeWidth={2} />
		</button>

		<!-- Ayarlar — venue settings. Lives at /settings for now; opened from the OS
		     rail so the classic sidebar is no longer the only way in. -->
		<button
			onclick={() => goto('/settings')}
			title="Ayarlar"
			class="grid h-10 w-10 place-items-center rounded-xl transition-colors
				{page.url.pathname.startsWith('/settings')
				? 'bg-text-1 text-white'
				: 'text-text-3 hover:bg-surface-2 hover:text-text-1'}"
		>
			<Settings size={19} strokeWidth={2} />
		</button>

		<!-- Yönetim (superadmin) no longer has its own rail icon — it moved inside the
		     Ayarlar page (owner request: the rail was getting crowded). Backend still
		     enforces requireSuperadmin on /admin either way. -->
	</nav>

	<!-- ── Canvas (lens views render here) ───────────────────────────────── -->
	<!-- Slightly cooler/darker than --color-bg so the white cards read as raised. -->
	<main bind:this={mainEl} class="relative overflow-y-auto px-7 py-6" style="background:#eef0f4">
		<!-- Navigation feedback: an indeterminate top bar while a lens load resolves.
		     SvelteKit holds the old page until `load` settles; this is the only cue
		     that a click registered. Rendered only during navigation, so no flicker
		     on instant transitions. -->
		{#if navigating.to}
			<div class="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-brand/15">
				<div class="nav-progress h-full w-1/3 bg-brand"></div>
			</div>
		{/if}

		<!-- Global lens menu — fixed above every lens's own hero/content.
		     Hidden on the platform detail page, which carries its own back nav. -->
		{#if !hideLensTabs}
			<LensTabs />
		{/if}
		{@render children()}
	</main>

	<!-- ── Assistant (skeleton shell — A1 wires the radar brain) ───────────
	     `demo` USED TO gate placeholder content here: the mock brief quoted the demo
	     venue's own figures, which read coherently in the demo but would have sat beside
	     a real customer's tiles saying something different — another hotel's numbers
	     wearing this hotel's frame. So a real tenant saw an honest "coming soon" shell
	     and the demo saw the mock.

	     The radar brain has landed, and the demo is now a real radar tenant
	     (TEN_DEMO_AURELIA: venue config + echo-pulled snapshots + its own scanned
	     alerts/goals). So BOTH sides read live from /api/agenda and the mock branch is
	     dead. Passing `false` rather than deleting the prop keeps this one diff small
	     and revertible; the branch itself comes out in a follow-up. -->
	<aside
		class="flex flex-col overflow-hidden border-l border-border bg-surface-1 shadow-[-16px_0_40px_-24px_rgba(15,23,42,0.18)] {assistantOpen
			? 'assistant-open'
			: ''}"
	>
		<!-- Sheet/drawer header (phone + tablet): the overlay needs its own close
		     affordance. Hidden ≥lg, where the aside is a fixed grid column. -->
		<div class="flex items-center justify-between border-b border-border px-4 py-2 lg:hidden">
			<span class="inline-flex items-center gap-1.5 text-[13px] font-bold text-text-1">
				<Sparkles size={15} strokeWidth={2} class="text-talkwo" />
				Asistan
			</span>
			<button
				onclick={() => (assistantOpen = false)}
				title="Kapat"
				class="grid h-8 w-8 place-items-center rounded-lg text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1"
			>
				<X size={18} strokeWidth={2} />
			</button>
		</div>
		<div class="min-h-0 flex-1">
			<AssistantPanel
				venueName={data?.session?.venueName ?? ''}
				demo={false}
			/>
		</div>
	</aside>
</div>

<!-- Assistant launcher (phone + tablet) — floats above the bottom tab bar on
     phones, bottom-right corner on tablets (no bottom bar there). Hidden while
     the sheet is open (the sheet covers it anyway, but the exit animation would
     flash it) and ≥lg, where the assistant is a permanent column. -->
{#if !assistantOpen}
	<button
		onclick={() => (assistantOpen = true)}
		title="Asistan"
		class="fixed right-4 bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] z-40 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-talkwo to-talkwo-2 text-white shadow-raised md:right-6 md:bottom-6 lg:hidden"
	>
		<Sparkles size={20} strokeWidth={2} />
	</button>
{/if}

<!-- ── Mobile bottom tab bar ─────────────────────────────────────────────
     The lens pills ARE the navigation (owner decision) — on phones they live in
     an app-style fixed bottom bar instead of the in-canvas LensTabs row (hidden
     <md). Rendered on EVERY os page, including the ones that set hideLensTabs:
     those only suppress the TOP pills to avoid stacking two button rows, a
     concern the bottom bar doesn't have. -->
<nav
	class="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
>
	{#each navTabs as item (item.lens)}
		{@const Icon = item.icon}
		<button
			onclick={() => go(item)}
			class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition-colors
				{activeKind === item.lens ? 'text-brand' : 'text-text-3'}"
		>
			<Icon size={19} strokeWidth={2} />
			<span class="max-w-full truncate">{item.label}</span>
		</button>
	{/each}
</nav>

<style>
	/* Indeterminate progress: a short segment sweeps left→right while loading. */
	.nav-progress {
		animation: nav-sweep 0.9s ease-in-out infinite;
	}
	@keyframes nav-sweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	/* Tablets (768–1023px) keep the vertical rail but NOT the fixed assistant
	   column — 384px out of an iPad-portrait 768px would leave the canvas 326px.
	   The aside becomes a right-side drawer over the content, opened by the same
	   floating launcher phones use; ≥1024px it returns to a permanent column. */
	@media (min-width: 768px) and (max-width: 1023px) {
		.os-shell {
			grid-template-columns: 58px minmax(0, 1fr) !important;
		}

		.os-shell > aside {
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			z-index: 60;
			width: 384px;
			max-width: 90vw;
			transform: translateX(100%);
			transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
		}
		.os-shell > aside.assistant-open {
			transform: translateX(0);
		}
	}

	/* Phones use a compact horizontal TOP bar (time window + globals) and a single
	   content column. Lens navigation is NOT here — the in-canvas pills carry it
	   (a mobile pill/bottom structure for those is planned separately). The
	   assistant remains available on larger screens, where it can be read beside
	   the active lens instead of competing with it for width. */
	@media (max-width: 767px) {
		.os-shell {
			grid-template-columns: minmax(0, 1fr) !important;
			grid-template-rows: auto minmax(0, 1fr);
		}

		.os-shell > nav {
			grid-column: 1;
			grid-row: 1;
			flex-direction: row;
			justify-content: flex-start;
			gap: 0.25rem;
			overflow-x: auto;
			padding: 0.5rem;
			border-right: 0;
			border-bottom: 1px solid var(--color-border);
		}

		.os-shell > nav > .flex-1 {
			display: none;
		}

		/* The rail duplicates LensTabs (both render from OS_NAV), so the compact bar
		   drops the lens icons and lets the in-canvas pills carry lens navigation.
		   Desktop's vertical rail keeps them. */
		.os-shell > nav > :global(.nav-lens) {
			display: none;
		}

		.os-shell > nav > :global(.mt-3) {
			margin-top: 0;
			flex-direction: row;
			border-top: 0;
			border-left: 1px solid var(--color-border);
			padding-top: 0;
			padding-left: 0.5rem;
		}

		/* The bar scrolls horizontally (overflow-x: auto), which would clip the
		   absolutely-positioned "Özel" popover — pin it to the viewport just below
		   the bar instead. (With the demo banner present the bar sits 2rem lower and
		   the popover overlaps its bottom edge — rare combo, accepted.) */
		.os-shell > nav :global(.custom-pop) {
			position: fixed;
			left: 0.75rem;
			right: 0.75rem;
			top: 3.75rem;
			bottom: auto;
			width: auto;
			margin-left: 0;
		}

		.os-shell > main {
			grid-column: 1;
			grid-row: 2;
			min-width: 0;
			padding: 1rem;
			/* Clear the fixed bottom tab bar (+ iOS home indicator). */
			padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
		}

		/* The assistant column becomes a full-screen sheet that slides up OVER the
		   canvas + bottom bar, toggled by the floating launcher. Kept mounted (not
		   display:none) so the panel's state — an in-progress chat — survives
		   open/close cycles. */
		.os-shell > aside {
			position: fixed;
			inset: 0;
			z-index: 60;
			border-left: 0;
			transform: translateY(100%);
			transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
		}
		.os-shell > aside.assistant-open {
			transform: translateY(0);
		}
	}
</style>
