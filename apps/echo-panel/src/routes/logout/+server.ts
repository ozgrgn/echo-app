/**
 * logout/+server.ts — clear the session cookies and send the user to /login.
 *
 * POST is the primary path (form/button, CSRF-safe). GET is offered too so a
 * plain <a href="/logout"> link works.
 */

import { redirect } from '@sveltejs/kit';
import { clearSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

const doLogout: RequestHandler = ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/login');
};

export const POST = doLogout;
export const GET = doLogout;
