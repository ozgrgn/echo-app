import { redirect } from '@sveltejs/kit';

// Root → ECHO OS. Auth guard in +layout.svelte sends unauthenticated
// users to /login regardless.
export function load() {
	throw redirect(307, '/os');
}

export const ssr = false;
