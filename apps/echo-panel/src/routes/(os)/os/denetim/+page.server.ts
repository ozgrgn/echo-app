import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

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
	generatedAt: string;
	reviews: { platform: string; months: Record<string, YggMonthStats> }[];
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
	warnings: string[];
}

export const load: PageServerLoad = async (event) => {
	const { locals, fetch, url } = event;
	const venueSlug = locals.session?.venueSlug;
	if (!venueSlug) throw error(401, 'Not authenticated');
	const token = locals.session?.token;

	// Default range: this year's season so far (Apr → current month). The season
	// convention (Apr–Nov operating window) matches the venue's YGG reporting
	// period; ?from=&to= (YYYY-MM) override for past-season audits.
	const now = new Date();
	const year = now.getUTCFullYear();
	const currentMonth = `${year}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
	const defaultFrom = `${year}-04`;
	const from = url.searchParams.get('from') ?? (currentMonth < defaultFrom ? `${year - 1}-04` : defaultFrom);
	const to = url.searchParams.get('to') ?? (currentMonth < defaultFrom ? `${year - 1}-11` : currentMonth);

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
