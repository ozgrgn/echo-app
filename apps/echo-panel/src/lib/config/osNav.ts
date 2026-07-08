/**
 * osNav — the SINGLE SOURCE OF TRUTH for ECHO OS primary navigation.
 *
 * Before this file, the rail (+layout.svelte) and the in-canvas LensTabs each
 * held their own hardcoded array — different order, and each with its own
 * `tripadvisor` hardcode for the Platformlar entry. They drifted. Now both nav
 * sites render from `OS_NAV`, so a change lands once.
 *
 * Each entry maps a lens to its canonical landing route. The Platformlar entry
 * points at the platform INDEX (/os/platform) — the overview/comparison page —
 * not a single channel. Deep-linking into one platform happens from there.
 */
import { LayoutGrid, Globe, Swords, Users } from '@lucide/svelte';
import type { LensKind } from '$lib/stores/osState.svelte';

export interface OsNavItem {
	/** lens kind this entry activates (drives the active-state highlight) */
	lens: LensKind;
	label: string;
	icon: typeof LayoutGrid;
	/** canonical landing route for this lens */
	href: string;
}

// Order is shared by rail and LensTabs — keep it stable.
export const OS_NAV: OsNavItem[] = [
	{ lens: 'genel', label: 'Genel', icon: LayoutGrid, href: '/os' },
	{ lens: 'platform', label: 'Platformlar', icon: Globe, href: '/os/platform' },
	{ lens: 'competitors', label: 'Rakipler', icon: Swords, href: '/os/competitors' },
	{ lens: 'departments', label: 'Departmanlar', icon: Users, href: '/os/departments' }
];

/**
 * Which lens does a pathname belong to? Derived from the URL so the nav highlight
 * survives HMR reloads (which reset the in-memory osState store). Longest matching
 * href wins because '/os' prefixes every OS route — first-match would always pick
 * Genel. Returns undefined when no entry matches (caller falls back to the store).
 */
export function lensForPath(pathname: string): LensKind | undefined {
	return [...OS_NAV]
		.filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
		.sort((a, b) => b.href.length - a.href.length)[0]?.lens;
}
