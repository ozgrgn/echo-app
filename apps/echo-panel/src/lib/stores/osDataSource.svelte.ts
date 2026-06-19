/**
 * osDataSource — runtime toggle between rich MOCK data and the LIVE backend for
 * the ECHO OS lenses. Unlike echo-ui's build-time MOCK_CONFIG, this flips at
 * runtime (persisted in localStorage) so a demo can switch "rich mock ↔ real
 * data" live, without a rebuild.
 *
 * Default is 'mock' — a fresh deploy / presentation shows the rich dataset first.
 */

type Source = 'mock' | 'live';
const KEY = 'echo.os.dataSource';

function load(): Source {
	if (typeof window === 'undefined') return 'mock';
	const v = localStorage.getItem(KEY);
	return v === 'live' ? 'live' : 'mock';
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
			if (typeof window !== 'undefined') localStorage.setItem(KEY, s);
		},
		toggle() {
			this.set(state.source === 'mock' ? 'live' : 'mock');
		}
	};
}

export const osDataSource = createOsDataSource();
