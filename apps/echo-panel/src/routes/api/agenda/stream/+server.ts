/**
 * api/agenda/stream/+server.ts — SSE passthrough for one assistant chat turn.
 *
 * POST { threadId, content, displayContent?, forceTool? } → pipes radar's
 * text/event-stream (event: token | tool | done | error) straight to the browser.
 * Same trust boundary as /api/agenda: the browser never talks to radar; scope
 * comes from the SESSION, and the turn requires a per-user identity (OTP) because
 * radar threads are per-user (G6). Radar re-validates forceTool against its own
 * allowlist — the shallow shape check here just drops garbage early.
 */

import { error, json } from '@sveltejs/kit';
import { streamRadarChat } from '$lib/server/radarApi';
import type { RadarScope } from '$lib/server/radarApi';
import { chatUser } from '$lib/server/session';
import { OS_WINDOWS } from '$lib/config/window';
import type { RequestHandler } from './$types';

const MAX_CONTENT_LENGTH = 4000;

export const POST: RequestHandler = async ({ request, locals, fetch }) => {
	if (!locals.session) throw error(401, 'Not authenticated');
	const user = chatUser(locals.session);
	if (!user) throw error(403, 'Sohbet için OTP girişi gerekli');

	const body = await request.json().catch(() => null);
	const threadId = String(body?.threadId ?? '');
	const content = String(body?.content ?? '').trim();
	if (!threadId) throw error(400, 'threadId required');
	if (!content) throw error(400, 'content required');
	if (content.length > MAX_CONTENT_LENGTH) throw error(400, 'Mesaj çok uzun');

	const displayContent =
		body?.displayContent != null ? String(body.displayContent).slice(0, 500) : undefined;
	const ft = body?.forceTool;
	const forceTool =
		ft && typeof ft.name === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{1,60}$/.test(ft.name)
			? { name: ft.name, args: ft.args && typeof ft.args === 'object' ? ft.args : {} }
			: undefined;

	// Kullanıcının AÇIK OLDUĞU pencere. Asistan bunu bilmezse departman/alt konu skorlarını
	// sabit 6 aylık snapshot'tan okur ve sayfadaki tabloyla farklı sayılar söyler — aynı
	// ekranda iki rakam (owner, 27 Tem). Değer istemciden geldiği için allowlist'ten geçer;
	// tanınmayan bir şey gelirse hiç gönderilmez (radar varsayılana düşer).
	const uiWindow = (OS_WINDOWS as readonly string[]).includes(String(body?.uiWindow))
		? String(body.uiWindow)
		: undefined;

	const scope: RadarScope = {
		tenantKey: locals.session.tenantKey,
		venueSlug: locals.session.venueSlug,
		userSub: user.sub,
		...(user.scope ? { scope: user.scope } : {})
	};

	const upstream = await streamRadarChat(scope, threadId, {
		content,
		...(displayContent ? { displayContent } : {}),
		...(forceTool ? { forceTool } : {}),
		...(uiWindow ? { uiWindow } : {})
	});

	if (!upstream.ok || !upstream.body) {
		const text = await upstream.text().catch(() => '');
		return json(
			{ error: text.slice(0, 200) || 'Asistan akışı başlatılamadı' },
			{ status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 }
		);
	}

	// Pipe the SSE body through untouched; disable buffering end-to-end.
	return new Response(upstream.body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
