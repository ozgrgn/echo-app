/**
 * api/venue-settings/+server.ts — same-origin write proxy for the settings page.
 *
 * PATCH { venueSlug, patch }. Reads locals.session.token and forwards to echo-api
 * over the private network, so the browser never needs the JWT to save settings.
 */

import { json, error } from '@sveltejs/kit';
import { patchVenueSettings } from '@talkwo/echo-ui';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, locals, fetch }) => {
	if (!locals.session) throw error(401, 'Not authenticated');
	// Demo sessions are read-only. The backend enforces this too (demoGate 403s every
	// mutating method for the demo tenant); this is the UI-side half, so the request never
	// leaves the panel and the failure is immediate rather than a round-trip away.
	if (locals.session.isDemo) throw error(403, 'Demo oturumu salt-okunurdur.');

	let body: { venueSlug?: string; patch?: Parameters<typeof patchVenueSettings>[1] };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body.venueSlug || !body.patch) throw error(400, 'venueSlug and patch required');

	try {
		await patchVenueSettings(body.venueSlug, body.patch, locals.session.token, {
			baseUrl: locals.apiBaseUrl,
			fetch
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Settings save failed';
		const m = /\b(4\d\d|5\d\d)\b/.exec(msg);
		throw error(m ? Number(m[1]) : 502, msg);
	}

	return json({ ok: true });
};
