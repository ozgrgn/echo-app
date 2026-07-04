import type { PageLoad } from './$types';

// Department detail lens. Real data (score rollup, breakdown, complaints, trend,
// mentions) is fetched client-side in +page.svelte from GET /v1/departments/:slug/
// :deptKey — the auth token lives in the client store. The loader only forwards
// the department key from the route param (an ops-engine canonical key: hk/fnb/…).
export const ssr = false;

export const load: PageLoad = async ({ params }) => {
	return { deptKey: params.dept };
};
