import type { PageServerLoad } from './$types';
import type { HistoryPoint } from '@talkwo/echo-ui';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES, DEMO_HISTORY } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import { parseOsWindow, windowParam, windowChartMode } from '$lib/config/window';

// Platform OVERVIEW lens (SSR) — the /os/platform index. Compares all channels
// side by side: blended context + per-channel HotelScore + per-channel history.
// A specific channel is deep-linked from here into /os/platform/[platform].
//
//   • 'mock' → rich per-platform demo scores + synthetic per-platform history.
//   • 'live' → real per-channel snapshots + blended 'all', fanned out in parallel.
//
// This mirrors the Genel loader's channel fan-out but drops the Genel-only
// payload (segments/impact/competitors) — the overview is platform-scoped.

const CHANNELS = ['tripadvisor', 'booking', 'google', 'holidaycheck'] as const;

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const { dataSource } = await event.parent();

	// ── MOCK source ──
	if (dataSource === 'mock') {
		return {
			blended: DEMO_HOTEL_SCORE,
			period: DEMO_HOTEL_SCORE.period,
			channels: CHANNELS.map((p) => ({
				platform: p as string,
				score: DEMO_PLATFORM_SCORES[p] ?? DEMO_HOTEL_SCORE
			})),
			platformHistories: CHANNELS.map((p, i) => ({
				platform: p as string,
				points: (DEMO_HISTORY as HistoryPoint[]).map((h) => ({
					...h,
					gpi: +(h.gpi + (i - 1.5) * 2).toFixed(1)
				}))
			})),
			blendedHistory: DEMO_HISTORY as HistoryPoint[]
		};
	}

	// ── LIVE source: ONE bundle call ──
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
