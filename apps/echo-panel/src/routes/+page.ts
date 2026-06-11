import { redirect } from '@sveltejs/kit';

// Root → dashboard. Auth guard in +layout.svelte sends unauthenticated
// users to /login regardless.
export function load() {
	throw redirect(307, '/dashboard');
}

export const ssr = false;
