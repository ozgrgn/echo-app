/**
 * api/review-dispute/+server.ts — same-origin proxy for removal-dispute tracking.
 *
 *   POST { reviewId, status } → { id, dispute }   (status 'none' clears)
 *
 * Separate from api/os/data (GET-only, read-through) for the same reason as
 * reply-suggest: this mutates state, so it gets its own route with its own guards.
 * Demo sessions are refused here AND 403'd by echo-backend's demoGate — a marketing
 * link must never scribble dispute flags onto fixture reviews.
 */

import { json, error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';
import type { RequestHandler } from './$types';

const STATUSES = new Set(['requested', 'removed', 'rejected', 'none']);

export const POST: RequestHandler = async (event) => {
	if (!event.locals.session) throw error(401, 'Not authenticated');
	if (event.locals.session.isDemo) throw error(403, 'Demo oturumunda itiraz kaydı tutulamaz.');

	let body: { reviewId?: string; status?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.reviewId || !body.status || !STATUSES.has(body.status)) {
		throw error(400, 'Provide { reviewId, status: requested|removed|rejected|none }');
	}

	const api = makeServerApi(event);
	try {
		// Tenant scoping happens on the backend: the review is matched under the
		// session's tenantKey, so a guessed foreign id reads as 404.
		return json(
			await api.setReviewDispute(
				body.reviewId,
				body.status as 'requested' | 'removed' | 'rejected' | 'none'
			)
		);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // SvelteKit error/redirect
		const msg = e instanceof Error ? e.message : 'İtiraz durumu kaydedilemedi';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}
};
