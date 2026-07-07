/**
 * OS time-window dimension — a single source of truth for the global window
 * selector in the rail. A window is a lookback horizon; the backend scores each
 * window separately (24mo == full history, the default). The whole OS shell reads
 * `?window=` from the URL so the horizon is shared across every lens, shareable,
 * and survives a refresh — no client-only state that SSR can't see.
 */

/** Selectable windows, widest → narrowest. '24mo' is the full-history default. */
export const OS_WINDOWS = ['24mo', '12mo', '6mo', '3mo'] as const;

export type OsWindow = (typeof OS_WINDOWS)[number];

export const DEFAULT_OS_WINDOW: OsWindow = '24mo';

/**
 * Rail selector rows. Labels are spelled out in Turkish (Ay/Yıl), widest first so
 * the list reads top→bottom from full history to current standing.
 */
export const OS_WINDOW_TABS: { key: OsWindow; label: string; short: string }[] = [
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

/** Whole-month lookback per window (mirrors the backend's WINDOW_MONTHS). */
const WINDOW_MONTHS: Record<OsWindow, number> = { '24mo': 24, '12mo': 12, '6mo': 6, '3mo': 3 };

/**
 * How a trend chart should render for a window:
 *   - wide windows (24mo/12mo) → MONTHLY series (/history), clean long view.
 *   - narrow windows (6mo/3mo) → DAILY series (/daily) from the window lower bound,
 *     so a short horizon reads at day resolution instead of 3–6 sparse month points.
 * `from` is an ISO 'YYYY-MM-DD' lower bound for the daily fetch (undefined for monthly).
 * `window` is the daily series to read (the SAME horizon as the KPI) — the daily points
 * for a narrow window are scored over that rolling window, so the chart's last point
 * equals the windowed KPI. Only set when `daily`.
 */
export function windowChartMode(
	w: OsWindow,
	now: Date
): { daily: boolean; from?: string; window?: OsWindow } {
	if (w === '24mo' || w === '12mo') return { daily: false };
	const d = new Date(now);
	d.setUTCMonth(d.getUTCMonth() - WINDOW_MONTHS[w]);
	return { daily: true, from: d.toISOString().slice(0, 10), window: w };
}
