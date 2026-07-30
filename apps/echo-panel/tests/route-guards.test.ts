import { describe, expect, it } from 'vitest';
import { load as appLoad } from '../src/routes/(app)/+layout.server';
import { load as osLoad } from '../src/routes/(os)/os/+layout.server';
import { load as rootLoad } from '../src/routes/+layout.server';

type Session = {
	token: string;
	tenantKey: string;
	venueSlug: string;
	venueName: string;
	isSuperadmin: boolean;
	isDemo?: boolean;
};

type GuardEvent = {
	locals: { session: Session | null };
	url: URL;
};

type GuardLoad = (event: GuardEvent) => unknown;

const regularSession: Session = {
	token: 'sensitive-token',
	tenantKey: 'TEN_LAGO',
	venueSlug: 'lago-hotel',
	venueName: 'Lago Hotel',
	isSuperadmin: false
};

function event(session: Session | null, pathname = '/dashboard'): GuardEvent {
	return {
		locals: { session },
		url: new URL(`https://echo.example${pathname}`)
	};
}

describe('root session projection', () => {
	it('returns null for an anonymous request', () => {
		expect((rootLoad as GuardLoad)(event(null))).toEqual({ session: null });
	});

	it('never exposes the bearer token to page data', () => {
		const result = (rootLoad as GuardLoad)(event(regularSession));

		expect(result).toEqual({
			session: {
				tenantKey: 'TEN_LAGO',
				venueSlug: 'lago-hotel',
				venueName: 'Lago Hotel',
				isSuperadmin: false
			}
		});
		expect(JSON.stringify(result)).not.toContain('sensitive-token');
	});
});

describe('classic app guard', () => {
	it('redirects anonymous users and preserves the intended path', () => {
		expect(() => (appLoad as GuardLoad)(event(null, '/categories/FOOD'))).toThrowError(
			expect.objectContaining({
				status: 303,
				location: '/login?redirectTo=%2Fcategories%2FFOOD'
			})
		);
	});

	it('redirects demo sessions to the supported OS surface', () => {
		expect(() =>
			(appLoad as GuardLoad)(event({ ...regularSession, isDemo: true }))
		).toThrowError(expect.objectContaining({ status: 303, location: '/os' }));
	});

	it('allows a regular tenant session without exposing its token', () => {
		const result = (appLoad as GuardLoad)(event(regularSession));

		expect(result).toMatchObject({
			session: {
				tenantKey: 'TEN_LAGO',
				venueSlug: 'lago-hotel',
				isSuperadmin: false
			}
		});
		expect(JSON.stringify(result)).not.toContain('sensitive-token');
	});
});

describe('OS guard', () => {
	it('rejects anonymous access', () => {
		expect(() => (osLoad as GuardLoad)(event(null, '/os/platform'))).toThrowError(
			expect.objectContaining({
				status: 303,
				location: '/login?redirectTo=%2Fos%2Fplatform'
			})
		);
	});

	it('allows a demo session and preserves the demo marker', () => {
		const result = (osLoad as GuardLoad)(
			event({ ...regularSession, isDemo: true }, '/os')
		);

		expect(result).toMatchObject({
			session: {
				tenantKey: 'TEN_LAGO',
				venueSlug: 'lago-hotel',
				isDemo: true
			}
		});
	});
});
