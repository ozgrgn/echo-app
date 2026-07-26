/**
 * api/reply-suggest/+server.ts — same-origin proxy for LLM reply drafting (G10).
 *
 *   POST { reviewId, regenerate? } → { reply, summaryTr, detectedLang, shouldReply, … }
 *
 * Separate from api/os/data (which is GET-only, read-through): this one is a POST that
 * SPENDS MONEY per call, so it gets its own route with its own guards rather than
 * becoming another `resource=` case.
 *
 * Demo sessions are refused outright — a marketing link must never be able to bill the
 * OpenAI account. echo-backend independently enforces tenant scope, its own per-venue
 * daily cap, and a rate limit; this is the outer gate, not the only one.
 */

import { json, error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');
	if (event.locals.session.isDemo) throw error(403, 'Demo oturumunda yanıt önerisi üretilemez.');

	let body: { reviewId?: string; regenerate?: boolean };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.reviewId) throw error(400, 'Provide { reviewId }');

	const api = makeServerApi(event);
	try {
		// The review is looked up under the session's tenant on the backend, so a
		// caller cannot draft against another tenant's review by guessing an id.
		return json(await api.suggestReply(body.reviewId, { regenerate: body.regenerate === true }));
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // SvelteKit error/redirect
		const msg = e instanceof Error ? e.message : 'Yanıt önerisi alınamadı';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
