/**
 * server/demoChatQuota.ts — daily question cap for the PUBLIC demo assistant.
 *
 * WHY. The demo link is handed out in marketing: anyone with the URL can open the
 * assistant, and every turn is a radar LLM call we pay for. Real tenants are bounded by
 * having a finite number of staff; the demo is bounded by nothing. So the demo — and only
 * the demo — gets a hard daily ceiling.
 *
 * THE UNIT IS THE LINK (`demoJti`), not the campaign and not the browser session. A
 * campaign (`sub`) can back several links, so metering on it would let one prospect burn
 * the allowance of everyone who got the same campaign's link. A cookie/session would reset
 * on a new incognito window, which is not a limit at all. `demoJti` is minted per link and
 * already travels in the demo staff token.
 *
 * IN-MEMORY, ON PURPOSE (for now). One counter map per server process, cleared when the
 * day rolls over. The trade-off, stated plainly so nobody discovers it later:
 *   - a restart resets every counter
 *   - a second instance keeps its own tally, so the effective ceiling is N × instances
 * Both mean the cap can be *exceeded*, never that a legitimate viewer is wrongly blocked.
 * For a marketing demo that is the right way round, and it keeps this dependency-free.
 * Move to Redis when the demo runs multi-instance or the bill says so.
 *
 * The day boundary is UTC — a viewer near midnight may see the allowance refresh at an odd
 * local hour, which is far less bad than a cap that resets on every process restart.
 */

/** Questions one demo link may ask per UTC day. */
export const DEMO_CHAT_DAILY_LIMIT = 10;

type Bucket = { day: string; used: number };

const buckets = new Map<string, Bucket>();

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Charge one question against a link's daily allowance.
 *
 * Returns { ok: true, remaining } when the turn may proceed — the charge has been taken.
 * Returns { ok: false, remaining: 0 } when the link is out for today; the caller should
 * refuse the turn (429) WITHOUT calling radar, since the point is not to spend the tokens.
 */
export function spendDemoChatQuota(jti: string): { ok: boolean; remaining: number; limit: number } {
	const day = today();
	const prev = buckets.get(jti);
	// New link, or the same link on a new day → a fresh allowance. Rolling the day over
	// lazily (here, on read) means no timer and no cleanup pass; a link that is never used
	// again just leaves one small stale entry behind.
	const bucket = prev && prev.day === day ? prev : { day, used: 0 };

	if (bucket.used >= DEMO_CHAT_DAILY_LIMIT) {
		buckets.set(jti, bucket);
		return { ok: false, remaining: 0, limit: DEMO_CHAT_DAILY_LIMIT };
	}

	bucket.used += 1;
	buckets.set(jti, bucket);
	return {
		ok: true,
		remaining: DEMO_CHAT_DAILY_LIMIT - bucket.used,
		limit: DEMO_CHAT_DAILY_LIMIT,
	};
}

/** Read a link's remaining allowance without charging it (for the UI hint). */
export function peekDemoChatQuota(jti: string): { remaining: number; limit: number } {
	const bucket = buckets.get(jti);
	const used = bucket && bucket.day === today() ? bucket.used : 0;
	return { remaining: Math.max(0, DEMO_CHAT_DAILY_LIMIT - used), limit: DEMO_CHAT_DAILY_LIMIT };
}

/** Test seam — drops every counter. */
export function __resetDemoChatQuota(): void {
	buckets.clear();
}
