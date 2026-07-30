import { describe, expect, it } from 'vitest';
import { chatUser, tokenClaims } from '../src/lib/server/session';

function unsignedToken(payload: Record<string, unknown>): string {
	const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${header}.${body}.`;
}

const identity = {
	tenantKey: 'TEN_LAGO',
	venueSlug: 'lago-hotel',
	venueName: 'Lago Hotel',
	isSuperadmin: false
};

describe('session claim projection', () => {
	it('accepts only the two supported authority scopes', () => {
		expect(tokenClaims(unsignedToken({ sub: 'staff-1', role: 'manager', scope: 'venue' }))).toEqual({
			sub: 'staff-1',
			role: 'manager',
			scope: 'venue'
		});
		expect(tokenClaims(unsignedToken({ sub: 'staff-1', role: 'manager', scope: 'unknown' }))).toEqual({
			sub: 'staff-1',
			role: 'manager'
		});
	});

	it('rejects malformed tokens and tokens without a subject', () => {
		expect(tokenClaims('not-a-token')).toBeNull();
		expect(tokenClaims(unsignedToken({ role: 'manager' }))).toBeNull();
	});
});

describe('assistant identity policy', () => {
	it('keeps legacy shared panel sessions out of per-user chat', () => {
		const session = {
			...identity,
			token: unsignedToken({ sub: 'echo-panel', role: 'panel' })
		};

		expect(chatUser(session)).toBeNull();
	});

	it('allows a real staff session with its authority scope', () => {
		const session = {
			...identity,
			token: unsignedToken({ sub: 'staff-1', role: 'manager', scope: 'department' })
		};

		expect(chatUser(session)).toEqual({
			sub: 'staff-1',
			role: 'manager',
			scope: 'department'
		});
	});

	it('requires a per-link identity for demo chat', () => {
		const withoutJti = {
			...identity,
			isDemo: true,
			token: unsignedToken({ sub: 'demo', role: 'demo' })
		};
		const withJti = {
			...withoutJti,
			token: unsignedToken({ sub: 'demo', role: 'demo', demoJti: 'link-123' })
		};

		expect(chatUser(withoutJti)).toBeNull();
		expect(chatUser(withJti)).toEqual({
			sub: 'demo',
			role: 'demo',
			demoJti: 'link-123'
		});
	});
});
