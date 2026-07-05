/**
 * osDataSource — runtime toggle between rich MOCK data and the LIVE backend for
 * the ECHO OS lenses. Unlike echo-ui's build-time MOCK_CONFIG, this flips at
 * runtime so a demo can switch "rich mock ↔ real data" live, without a rebuild.
 *
 * Default is 'live' — the OS lenses read from the real backend. A user can flip
 * to 'mock' (rail Database toggle) for a backend-free demo.
 *
 * Persistence: mirrored to BOTH localStorage (client convenience) AND a cookie
 * `echo_os_source` (so the SSR layout server load can honor "mock = no auth"
 * and render the demo dataset server-side without a hydration mismatch).
 */

type Source = 'mock' | 'live';
const KEY = 'echo.os.dataSource';
export const OS_SOURCE_COOKIE = 'echo_os_source';

function readCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
	return m ? decodeURIComponent(m[1]) : null;
}

function load(): Source {
	if (typeof window === 'undefined') return 'live'; // SSR: server reads the cookie itself
	// Cookie is the SSR source of truth; fall back to localStorage, then 'live'.
	const c = readCookie(OS_SOURCE_COOKIE);
	if (c === 'mock' || c === 'live') return c;
	const v = localStorage.getItem(KEY);
	return v === 'mock' ? 'mock' : 'live';
}

function createOsDataSource() {
	const state = $state<{ source: Source }>({ source: load() });

	return {
		get source() {
			return state.source;
		},
		get isMock() {
			return state.source === 'mock';
		},
		set(s: Source) {
			state.source = s;
			if (typeof window !== 'undefined') {
				localStorage.setItem(KEY, s);
				// Non-HttpOnly, readable cookie: the server needs it in the layout load.
				// 1-year maxAge; SameSite=Lax so navigations carry it.
				document.cookie = `${OS_SOURCE_COOKIE}=${s}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
			}
		},
		toggle() {
			this.set(state.source === 'mock' ? 'live' : 'mock');
		}
	};
}

export const osDataSource = createOsDataSource();
