/**
 * OS time-window dimension — a single source of truth for the global window
 * selector in the rail. A window is a lookback horizon; the backend scores each
 * window separately (24mo == full history, the default). The whole OS shell reads
 * `?window=` from the URL so the horizon is shared across every lens, shareable,
 * and survives a refresh — no client-only state that SSR can't see.
 */

/**
 * Selectable windows, widest → narrowest. '24mo' is the DEFAULT (absent ?window).
 * 'max' = lifetime ("Tümü") — no lower bound, every analyzed review. It's OWNED-only
 * territory: in the 'max' lens the panel hides RPI + competitor comparison (an owned
 * venue's full history isn't comparable to a competitor's ~2 analyzed years).
 */
export const OS_WINDOWS = ['max', '24mo', '12mo', '6mo', '3mo'] as const;

export type OsWindow = (typeof OS_WINDOWS)[number];

export const DEFAULT_OS_WINDOW: OsWindow = '24mo';

/** True for windows where competitor comparison (RPI, rival delta, Rakipler) is
 *  meaningless and must be hidden — currently only 'max' (see triage doc). */
export function hidesCompetitors(w: OsWindow): boolean {
	return w === 'max';
}

/**
 * Rail selector rows. Labels are spelled out in Turkish, widest first so the list
 * reads top→bottom from lifetime to current standing. 'Tümü' leads.
 */
export const OS_WINDOW_TABS: { key: OsWindow; label: string; short: string }[] = [
	{ key: 'max', label: 'Tümü', short: 'Tümü' },
	{ key: '24mo', label: '2 Yıl', short: '2Y' },
	{ key: '12mo', label: '1 Yıl', short: '1Y' },
	{ key: '6mo', label: '6 Ay', short: '6A' },
	{ key: '3mo', label: '3 Ay', short: '3A' }
];

/** Parse a raw `?window=` value; unknown/absent → the full-history default. */
export function parseOsWindow(raw: string | null | undefined): OsWindow {
	return OS_WINDOWS.includes(raw as OsWindow) ? (raw as OsWindow) : DEFAULT_OS_WINDOW;
}

/**
 * The `?window=` query string to pass to a scored endpoint, or undefined for the
 * default (so the backend applies its own default and URLs stay clean at 24mo).
 */
export function windowParam(w: OsWindow): string | undefined {
	return w === DEFAULT_OS_WINDOW ? undefined : w;
}

/**
 * How far BACK the chart draws — a different axis from the window itself. The window
 * says how much history each POINT summarizes ("this day's score over the last 24
 * months"); this says how many points to show. They coincide for 12mo/6mo/3mo. 'max'
 * scores over all time but still needs a finite chart horizon, so it draws the same
 * 24 months as the default — a lifetime line would be a decade of points, most of them
 * from before we had data.
 */
const CHART_MONTHS: Record<OsWindow, number> = { max: 24, '24mo': 24, '12mo': 12, '6mo': 6, '3mo': 3 };

/**
 * How a trend chart should render for a window. EVERY window now reads the same store
 * (score_snapshots_daily) — `daily` no longer picks a COLLECTION, only a RESOLUTION:
 *   - narrow (6mo/3mo) → `daily: true`, raw day points; a short horizon deserves day detail.
 *   - wide (max/24mo/12mo) → `daily: false`, the backend thins the same daily series to
 *     one point per month-end (plus today), so a 1–2 year chart stays readable.
 *
 * The old wide path read the monthly score_snapshots collection instead, which grouped
 * by calendar month and therefore ended on a HALF-FINISHED month — the phantom "GPI is
 * dropping" the KPI delta was reading. Every daily point is a complete rolling-window
 * measurement, so that whole class of bug is gone.
 *
 * `from` bounds the fetch (CHART_MONTHS back — the chart's horizon, not the window's).
 * `window` names the series to read: the SAME horizon as the KPI, so the chart's last
 * point equals the headline number.
 */
export function windowChartMode(
	w: OsWindow,
	now: Date
): { daily: boolean; from?: string; window?: OsWindow } {
	const d = new Date(now);
	d.setUTCMonth(d.getUTCMonth() - CHART_MONTHS[w]);
	return {
		daily: w === '6mo' || w === '3mo',
		from: d.toISOString().slice(0, 10),
		window: w
	};
}
