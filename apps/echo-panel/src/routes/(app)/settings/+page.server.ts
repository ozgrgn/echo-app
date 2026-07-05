import type { PageServerLoad } from './$types';
import type { EchoSubscription } from '@talkwo/echo-core';
import { listVenues } from '@talkwo/echo-ui';
import { error } from '@sveltejs/kit';
import { makeServerApi } from '$lib/server/echoApi';

// Phase 1 mock region labels — Phase 2: from backend venue metadata
const COMPETITOR_REGIONS: Record<string, string> = {
	'crystal-sunset-luxury-resort-spa': 'Side',
	'rixos-premium-belek':              'Belek',
	'titanic-deluxe-belek':             'Belek',
	'barut-hemera':                     'Side',
	'voyage-sorgun':                    'Sorgun',
};

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
		competitorRegions: COMPETITOR_REGIONS,
		venueSettings,
	};
};
