import type { PageServerLoad } from './$types';
import type { SegmentsResponse, HistoryPoint, ImpactResponse } from '@talkwo/echo-ui';
import { DEMO_HOTEL_SCORE, DEMO_PLATFORM_SCORES, DEMO_COMPETITORS, DEMO_SEGMENTS, DEMO_HISTORY } from '$lib/mock/os';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// SSR server load. Source is decided by the layout server load (echo_os_source
// cookie): 'mock' → rich demo dataset (no auth); 'live' → real backend over the
// private network (locals session token + request fetch).

const CHANNELS = ['tripadvisor', 'booking', 'google', 'holidaycheck'] as const;

// Demo impact for mock mode: derive a plausible leverage list from the demo
// hotel's category scores. Real mode uses the backend's counterfactual GPI math.
function demoImpact(): ImpactResponse {
	const target = 85;
	const cats = (DEMO_HOTEL_SCORE.categoryScores ?? [])
		.filter((c) => c.aspectScore != null)
		.map((c) => {
			const score = c.aspectScore as number;
			const lift = Math.max(0, ((target - score) / 100) * Math.log10(c.mentionCount + 1) * 3);
			return {
				category: c.category,
				label: c.category,
				aspectScore: Math.round(score * 10) / 10,
				mentionCount: c.mentionCount,
				liftToTarget: Math.round(lift * 10) / 10,
				dragFromTop: Math.round((score - target) * 10) / 10
			};
		})
		.sort((a, b) => b.liftToTarget - a.liftToTarget);
	return { gpi: DEMO_HOTEL_SCORE.gpi, target, categories: cats, underMeasured: [] };
}

export const load: PageServerLoad = async (event) => {
	const { url, parent } = event;
	const { dataSource } = await parent();

	// ── MOCK source: rich demo data, no auth/backend needed ──────────────────
	if (dataSource === 'mock') {
		return {
			hotelScore: DEMO_HOTEL_SCORE,
			competitors: DEMO_COMPETITORS,
			channels: CHANNELS.map((p) => ({ platform: p, score: DEMO_PLATFORM_SCORES[p] })),
			period: DEMO_HOTEL_SCORE.period,
			segments: DEMO_SEGMENTS as SegmentsResponse,
			history: DEMO_HISTORY as HistoryPoint[],
			platformHistories: CHANNELS.map((p, i) => ({
				platform: p as string,
				points: (DEMO_HISTORY as HistoryPoint[]).map((h) => ({ ...h, gpi: +(h.gpi + (i - 1.5) * 2).toFixed(1) }))
			})),
			impact: demoImpact()
		};
	}

	// ── LIVE source: real backend over the private network ───────────────────
	const venueSlug = event.locals.session?.venueSlug;
	if (!venueSlug) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const paramPeriod = url.searchParams.get('period');
	const requestPeriod = /^\d{4}-\d{2}$/.test(paramPeriod ?? '') ? (paramPeriod as string) : undefined;

	const [hotelScore, competitors, segments, history, platformHistories, ...channelResults] =
		await Promise.all([
			api.getHotelScore(venueSlug, requestPeriod),
			api.getCompetitorScores(venueSlug, requestPeriod),
			// Best-effort: a failure must not break the whole lens.
			api.getSegments(venueSlug).catch(() => null),
			api
				.getScoreHistory(venueSlug, { platform: 'all', limit: 24 })
				.then((r) => r.points)
				.catch(() => null),
			Promise.all(
				CHANNELS.map((p) =>
					api
						.getScoreHistory(venueSlug, { platform: p, limit: 24 })
						.then((r) => ({ platform: p as string, points: r.points }))
						.catch(() => null)
				)
			).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null && r.points.length > 1)),
			...CHANNELS.map((p) =>
				api
					.getHotelScore(venueSlug, requestPeriod, p)
					.then((s) => ({ platform: p, score: s }))
					.catch(() => null)
			)
		]);

	const channels = channelResults.filter((c): c is NonNullable<typeof c> => c !== null);

	const impact = await api
		.getImpact(venueSlug, requestPeriod ? { period: requestPeriod } : {})
		.catch(() => null);

	return { hotelScore, competitors, channels, period: hotelScore.period, segments, history, platformHistories, impact };
};
