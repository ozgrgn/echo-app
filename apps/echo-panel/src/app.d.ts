// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionIdentity, RefreshCreds } from '$lib/server/session';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Authenticated session (token + identity) from cookies, or null. */
			session: (SessionIdentity & { token: string }) | null;
			/** Decrypted refresh creds for server-side 401 re-auth, or null. */
			refresh: RefreshCreds | null;
			/** Resolved echo-api base URL for server-side fetch (internal in prod). */
			apiBaseUrl: string;
		}
		interface PageData {
			/** Non-sensitive identity surfaced to the client (no token). */
			session?: SessionIdentity | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
