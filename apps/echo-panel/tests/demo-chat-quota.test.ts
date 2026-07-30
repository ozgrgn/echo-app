import { beforeEach, describe, expect, it } from 'vitest';
import {
	__resetDemoChatQuota,
	DEMO_CHAT_DAILY_LIMIT,
	peekDemoChatQuota,
	spendDemoChatQuota
} from '../src/lib/server/demoChatQuota';

beforeEach(() => {
	__resetDemoChatQuota();
});

describe('public demo assistant quota', () => {
	it('charges a turn and reports the remaining allowance', () => {
		expect(peekDemoChatQuota('link-a')).toEqual({
			remaining: DEMO_CHAT_DAILY_LIMIT,
			limit: DEMO_CHAT_DAILY_LIMIT
		});
		expect(spendDemoChatQuota('link-a')).toEqual({
			ok: true,
			remaining: DEMO_CHAT_DAILY_LIMIT - 1,
			limit: DEMO_CHAT_DAILY_LIMIT
		});
	});

	it('blocks calls after the daily allowance is exhausted', () => {
		for (let index = 0; index < DEMO_CHAT_DAILY_LIMIT; index += 1) {
			expect(spendDemoChatQuota('link-a').ok).toBe(true);
		}

		expect(spendDemoChatQuota('link-a')).toEqual({
			ok: false,
			remaining: 0,
			limit: DEMO_CHAT_DAILY_LIMIT
		});
	});

	it('isolates quota by demo link identity', () => {
		for (let index = 0; index < DEMO_CHAT_DAILY_LIMIT; index += 1) {
			spendDemoChatQuota('link-a');
		}

		expect(spendDemoChatQuota('link-a').ok).toBe(false);
		expect(spendDemoChatQuota('link-b').ok).toBe(true);
	});
});
