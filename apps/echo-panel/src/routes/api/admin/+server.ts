/**
 * api/admin/+server.ts — same-origin write proxy for the superadmin /admin page.
 *
 * With the JWT in an HttpOnly cookie, the browser can't call the backend admin
 * writes directly (auth.token is null client-side). Instead the page POSTs here;
 * the server reads locals.session.token and forwards to echo-api over the private
 * network. Body: { action, ...args }. Superadmin authorization is enforced by the
 * backend (requireSuperadmin) — this proxy just carries the token.
 */

import { json, error } from '@sveltejs/kit';
import {
	patchVenuePlatforms,
	patchVenueRefs,
	patchVenueSeasons,
	createWatch,
	deleteWatch,
	type PlatformRefs
} from '@talkwo/echo-ui';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, fetch }) => {
	if (!locals.session) throw error(401, 'Not authenticated');
	// Demo sessions are read-only. The backend enforces this too (demoGate 403s every
	// mutating method for the demo tenant); this is the UI-side half, so the request never
	// leaves the panel and the failure is immediate rather than a round-trip away.
	if (locals.session.isDemo) throw error(403, 'Demo oturumu salt-okunurdur.');
	const token = locals.session.token;
	const opts = { baseUrl: locals.apiBaseUrl, fetch };

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const action = body.action as string;
	try {
		switch (action) {
			case 'patchPlatforms':
				await patchVenuePlatforms(
					body.venueId as string,
					body.patch as { watchedPlatforms?: string[]; platformRefs?: PlatformRefs },
					token,
					opts
				);
				break;
			case 'patchRefs':
				await patchVenueRefs(body.venueId as string, body.refs as PlatformRefs, token, opts);
				break;
			case 'patchSeasons':
				await patchVenueSeasons(
					body.venueId as string,
					body.operatingSeasons as { start: string; end: string }[],
					token,
					opts
				);
				break;
			case 'createWatch':
				await createWatch(body.ownerVenueId as string, body.targetVenueId as string, token, opts);
				break;
			case 'deleteWatch':
				await deleteWatch(body.ownerVenueId as string, body.targetVenueId as string, token, opts);
				break;
			default:
				throw error(400, `Unknown action: ${action}`);
		}
	} catch (e) {
		// Surface a 4xx/5xx from the backend as the same status where possible.
		const msg = e instanceof Error ? e.message : 'Admin write failed';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}

	return json({ ok: true });
};
