import type { PageLoad } from './$types';
import { getHotelScore, getCompetitorScores, getSegments, getScoreHistory } from '@talkwo/echo-ui';
import type { SegmentsResponse, HistoryPoint } from '@talkwo/echo-ui';
import { auth } from '$lib/stores/auth.svelte';
import { osDataSource } from '$lib/stores/osDataSource.svelte';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES, DEMO_COMPETITORS, DEMO_SEGMENTS, DEMO_HISTORY } from '$lib/mock/os';
import { error } from '@sveltejs/kit';

// Client-side load. Source toggles at runtime (osDataSource):
//   • 'mock' → rich demo dataset (presentations) — no backend needed.
//   • 'live' → blended ('all') + per-channel snapshots from the real backend.
export const ssr = false;

const CHANNELS = ['tripadvisor', 'booking', 'google', 'holidaycheck'] as const;

export const load: PageLoad = async ({ url }) => {
	// ── MOCK source: rich demo data, no auth/backend needed ──────────────────
	if (osDataSource.isMock) {
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			channels: CHANNELS.map((p) => ({ platform: p, score: DEMO_PLATFORM_SCORES[p] })),
			period: DEMO_HOTEL_SCORE.period,
			segments: DEMO_SEGMENTS as SegmentsResponse,
			history: DEMO_HISTORY as HistoryPoint[],
		};
	}

	// ── LIVE source: real backend ────────────────────────────────────────────
	const { token, venueSlug } = auth;
	if (!token || !venueSlug) {
		throw error(401, 'Not authenticated');
	}

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '')
		? (paramPeriod as string)
		: undefined;

	const [hotelScore, competitors, segments, history, ...channelResults] = await Promise.all([
		getHotelScore(venueSlug, requestPeriod, token),
		getCompetitorScores(venueSlug, requestPeriod, token),
		// Segments + history are best-effort: a failure must not break the whole lens.
		getSegments(venueSlug, token).catch(() => null),
		getScoreHistory(venueSlug, token, { platform: 'all', limit: 24 })
			.then((r) => r.points)
			.catch(() => null),
		...CHANNELS.map((p) =>
			getHotelScore(venueSlug, requestPeriod, token, p)
				.then((s) => ({ platform: p, score: s }))
				.catch(() => null)
		)
	]);

	const channels = channelResults.filter((c): c is NonNullable<typeof c> => c !== null);

	return { hotelScore, competitors, channels, period: hotelScore.period, segments, history };
};
