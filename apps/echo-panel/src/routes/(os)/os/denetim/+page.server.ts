import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

/**
 * /os/denetim — YGG (management review / audit) snapshot loader.
 *
 * ONE call to echo-backend's /v1/reports/ygg — the backend merges its own
 * review statistics with the survey + MGB feedback aggregations it pulls from
 * ops-engine, so this loader stays a thin passthrough. Self-contained fetch
 * (no echoApi dependency): the report is read-only and renders a static
 * printable document, so the 401-refresh machinery isn't needed here — an
 * expired session just walks through /login like any direct navigation.
 */

export interface YggMonthStats {
	total: number;
	complaints: number;
	positives: number;
}

export interface YggReport {
	venueSlug: string;
	venueName: string;
	from: string;
	to: string;
	months: string[];
	/** Same months, previous year — the slide-style comparison axis. */
	prevMonths: string[];
	generatedAt: string;
	reviews: { platform: string; months: Record<string, YggMonthStats> }[];
	reviewsPrevYear: { platform: string; months: Record<string, YggMonthStats> }[];
	topics: { key: string; label: string; total: number; months: Record<string, number> }[];
	surveys: {
		sent: Record<string, number>;
		responded: Record<string, number>;
		categories: { key: string; label: string; months: Record<string, { pct: number; n: number }> }[];
		choices: { key: string; months: Record<string, Record<string, number>> }[];
	} | null;
	feedback: {
		sentimentTotals: Record<string, Record<string, number>>;
		departments: { key: string; label: string; months: Record<string, Record<string, number>> }[];
		topics: { key: string; label: string; total: number; months: Record<string, number> }[];
	} | null;
	surveysPrevYear: {
		year: string;
		source: string;
		categories: { key: string; label: string; months: Record<string, number> }[];
	} | null;
	dining: {
		outlets: {
			id: string;
			label: string;
			kind: 'alacarte' | 'pavilion';
			months: Record<
				string,
				{ bookings: number; pax: number; freeBookings: number; revenue: Record<string, number> }
			>;
		}[];
	} | null;
	warnings: string[];
}

export const load: PageServerLoad = async (event) => {
	const { locals, fetch, url } = event;
	// This page breaks out of the (os) layout (+page@.svelte) for a clean,
	// chrome-free printable document — the os layout's auth guard is skipped
	// with it, so the login redirect lives here.
	const venueSlug = locals.session?.venueSlug;
	if (!venueSlug) throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	const token = locals.session?.token;

	// Default range: the FULL season (Apr–Nov of the current season year), matching
	// the YGG deck's column layout — future months render as em-dashes, so the same
	// document simply fills in as the season progresses. Before April we're still
	// reporting on the previous season. ?from=&to= (YYYY-MM) override for archives.
	const now = new Date();
	const currentMonth = now.toISOString().slice(0, 7);
	const seasonYear = currentMonth < `${now.getUTCFullYear()}-04` ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
	const from = url.searchParams.get('from') ?? `${seasonYear}-04`;
	const to = url.searchParams.get('to') ?? `${seasonYear}-11`;

	// locals.apiBaseUrl already ends with /v1 (see apiBaseUrl.ts).
	const res = await fetch(
		`${locals.apiBaseUrl}/reports/ygg/${encodeURIComponent(venueSlug)}?from=${from}&to=${to}`,
		{ headers: { Authorization: `Bearer ${token}` } }
	);
	if (res.status === 401) throw error(401, 'Oturum süresi doldu — yeniden giriş yapın');
	if (!res.ok) throw error(res.status, `Rapor alınamadı (HTTP ${res.status})`);

	const report = (await res.json()) as YggReport;
	return { report };
};
