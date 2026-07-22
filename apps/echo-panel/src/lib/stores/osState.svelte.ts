/**
 * osState — the shared state store for ECHO OS (the 3-column shell).
 *
 * This is the spine of the assistant↔canvas two-way binding (ECHO_OS_PLAN.md):
 *   - UI state: active lens, selected platform/department/subcategory, period,
 *     filters, selected thread.
 *   - Machine-readable SCREEN SNAPSHOT: what the assistant's `explainScreen` tool
 *     reads, and what `applyFilter`/`openLens` UI-action tools WRITE. The assistant
 *     drives the canvas through this store; the canvas reports its state through it.
 *
 * v1 (B1) holds UI state + the snapshot shape only. Wiring the assistant to it is
 * A1 work — but the snapshot contract is defined here now so both sides agree.
 */

// A lens is one context lens of the single assistant brain (not a separate brain).
export type LensKind = 'genel' | 'platform' | 'competitors' | 'departments' | 'department';

export type PlatformKey = 'tripadvisor' | 'booking' | 'google' | 'holidaycheck';

export type Period = 'weekly' | 'monthly';

export interface OsLens {
	kind: LensKind;
	/** set when kind==='platform' */
	platform?: PlatformKey;
	/** set when kind==='department' (ops canonical key) */
	department?: string;
	/** optional zoom within a department lens (a subcategory) */
	subcategory?: string;
}

/**
 * Screen snapshot handed to the assistant. The component catalog lets the LLM
 * target real elements by STABLE SEMANTIC NAME (e.g. 'gpi-goal-table') instead of
 * fragile selectors — highlightComponent resolves these to the DOM on the frontend.
 */
export interface ScreenSnapshot {
	lens: OsLens;
	period: Period;
	/** semantic ids of components currently rendered (what the LLM may target) */
	visibleComponents: string[];
	/** active filters the user/assistant applied */
	filters: Record<string, unknown>;
}

function createOsState() {
	const state = $state<{
		lens: OsLens;
		period: Period;
		filters: Record<string, unknown>;
		selectedThreadId: string | null;
		/** semantic id flagged by the assistant's highlightComponent UI-action */
		highlighted: { component: string; effect: string } | null;
		/** "?" popover → "Asistana sor" handoff (A1): the panel consumes and clears it. */
		askMetric: { metricId: string; window?: string; currentValue?: number } | null;
	}>({
		lens: { kind: 'genel' },
		period: 'monthly',
		filters: {},
		selectedThreadId: null,
		highlighted: null,
		askMetric: null
	});

	// The set of visible components is lens-derived; pages may extend it but this
	// default keeps the snapshot honest about what's on screen per lens.
	function visibleFor(lens: OsLens): string[] {
		switch (lens.kind) {
			case 'genel':
				return [
					'kpi-gpi', 'kpi-rpi', 'kpi-reviews', 'kpi-response', 'kpi-gap',
					'gpi-trend-chart', 'platform-list', 'category-movement',
					'top-issues', 'top-praises', 'department-grid'
				];
			case 'platform':
				return ['platform-hero', 'platform-trend', 'platform-distribution', 'platform-categories', 'opportunity-list'];
			case 'department':
				return ['dept-hero', 'dept-goals', 'dept-subcategories', 'dept-issues'];
			default:
				return [];
		}
	}

	return {
		get lens() {
			return state.lens;
		},
		get period() {
			return state.period;
		},
		get filters() {
			return state.filters;
		},
		get selectedThreadId() {
			return state.selectedThreadId;
		},
		get highlighted() {
			return state.highlighted;
		},

		/** Whether the current lens may WRITE goals (only department lenses can). */
		get canSetGoals() {
			return state.lens.kind === 'department';
		},

		/** The snapshot the assistant reads. Single source of canvas truth. */
		get snapshot(): ScreenSnapshot {
			return {
				lens: state.lens,
				period: state.period,
				visibleComponents: visibleFor(state.lens),
				filters: state.filters
			};
		},

		// ── Mutations — also the targets of the assistant's UI-action tools ──────
		setLens(lens: OsLens) {
			state.lens = lens;
			state.highlighted = null; // reset focus when the view changes
		},
		setPeriod(p: Period) {
			state.period = p;
		},
		/** applyFilter UI-action lands here. */
		setFilter(key: string, value: unknown) {
			state.filters = { ...state.filters, [key]: value };
		},
		clearFilters() {
			state.filters = {};
		},
		selectThread(id: string | null) {
			state.selectedThreadId = id;
		},
		/** highlightComponent UI-action lands here (spotlight/dim/pulse…). */
		highlight(component: string, effect: string) {
			state.highlighted = { component, effect };
		},
		clearHighlight() {
			state.highlighted = null;
		},

		// ── "?" → assistant handoff (metric methodology, G5 Faz 1) ──────────────
		get askMetric() {
			return state.askMetric;
		},
		/** MetricInfo popover's "Asistana sor" writes here; AssistantPanel reacts. */
		askAssistant(req: { metricId: string; window?: string; currentValue?: number }) {
			state.askMetric = req;
		},
		clearAskMetric() {
			state.askMetric = null;
		}
	};
}

export const osState = createOsState();
