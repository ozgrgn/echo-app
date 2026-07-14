import type { PageServerLoad } from './$types';
import type { EchoSubscription } from '@talkwo/echo-core';
import { listVenues } from '@talkwo/echo-ui';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Region labels used to come from a hard-coded slug→town map naming one customer's real
// rivals. Removed: a venue's own metadata (venue.region.area) is the only source now, and
// a venue without it renders '—' rather than a label the frontend invented.

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw error(401, 'Not authenticated');
	const api = makeServerApi(event);

	const [allVenues, venueSettings] = await Promise.all([
		// listVenues has no makeServerApi binding — call the echo-ui fetcher directly.
		listVenues(session.token, { baseUrl: event.locals.apiBaseUrl, fetch: event.fetch }),
		api.getVenueSettings(session.venueSlug),
	]);

	const ownVenue = allVenues.find((v) => v.slug === session.venueSlug);
	const competitors = allVenues.filter((v) => !v.isOwned);

	return {
		ownVenue,
		competitors,
		venueName: session.venueName ?? session.venueSlug,
		tenantKey: session.tenantKey,
		// Subscription is not carried in the server session; the page tolerates null.
		subscription: null as EchoSubscription | null,
		venueSettings,
	};
};
