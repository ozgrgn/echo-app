import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam, windowChartMode } from '$lib/config/window';

// Platform OVERVIEW lens (SSR) — the /os/platform index. Compares all channels
// side by side: blended context + per-channel HotelScore + per-channel history.
// A specific channel is deep-linked from here into /os/platform/[platform].
//
// The old `dataSource === 'mock'` fork (synthetic per-platform scores/history behind
// a client-settable cookie) is gone; demo tenants now arrive with a real session and
// read backend fixtures through this same live path.
//
// This mirrors the Genel loader's channel fan-out but drops the Genel-only
// payload (segments/impact/competitors) — the overview is platform-scoped.

export const load: PageServerLoad = async (event) => {
	const { url } = event;

	// ── ONE bundle call ──
	// Perf: this lens used to make ~10 parallel HTTP calls (blended + per-channel
	// scores + per-channel histories). Now one round-trip; lens='platform' tells the
	// backend to skip competitors/segments/impact (no over-fetch).
	const venueSlug = event.locals.session?.venueSlug;
	if (!venueSlug) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	const window = parseOsWindow(url.searchParams.get('window'));
	const w = windowParam(window);
	const chart = windowChartMode(window, new Date());

	const b = await api.getOsBundle(venueSlug, {
		lens: 'platform',
		window: w,
		period: requestPeriod,
		chartDaily: chart.daily,
		chartFrom: chart.from
	});

	// The bundle 404s without a snapshot, so a 200 always carries blended.
	if (!b.blended) throw error(404, 'No score snapshot for this venue');

	return {
		blended: b.blended,
		period: b.period ?? b.blended?.period,
		channels: b.channels,
		platformHistories: b.platformHistories,
		blendedHistory: b.blendedHistory,
		window,
		chartDaily: chart.daily
	};
};
