/**
 * api/review-translate/+server.ts — same-origin proxy for review→Turkish translation.
 *
 *   POST { reviewId } → { titleTr, textTr, detectedLang, model, generatedAt, cached }
 *
 * Own route (not an api/os/data resource) for the same reason as reply-suggest:
 * the first call per review SPENDS MONEY, so it gets its own guards. Demo sessions
 * are refused outright — a marketing link must never bill the OpenAI account.
 */

import { json, error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');
	if (event.locals.session.isDemo) throw error(403, 'Demo oturumunda çeviri üretilemez.');

	let body: { reviewId?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.reviewId) throw error(400, 'Provide { reviewId }');

	const api = makeServerApi(event);
	try {
		return json(await api.translateReview(body.reviewId));
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // SvelteKit error/redirect
		const msg = e instanceof Error ? e.message : 'Çeviri alınamadı';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
