import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Fail loudly if 5173 is already taken (instead of silently grabbing
		// the next free port). Reason: a stale dev server on 5173 + a fresh
		// one on 5174 leads to "Failed to fetch dynamically imported module"
		// errors when the browser keeps a tab open on the old port. Strict-
		// port forces us to clean up zombies before starting a new dev.
		strictPort: true,
		port: 5173,
		// Dev-only CORS bypass: Vite's Node proxy forwards /v1/* server-to-server,
		// so the browser never makes a cross-origin request and CORS doesn't apply.
		// Set PUBLIC_ECHO_API_URL=/v1 in .env.local to route through here.
		//   local backend  → target: 'http://localhost:3001'
		//   Railway backend → target: 'https://backend-production-5c03.up.railway.app'
		proxy: {
			'/v1': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
		},
	},
	ssr: {
		// Force Vite to transform workspace packages during SSR (not pass them
		// through to Node's native ESM resolver). Necessary because our shared
		// packages use TypeScript `.js` import suffixes that only work under
		// bundler resolution, not Node's native module resolution.
		noExternal: ['@talkwo/echo-core', '@talkwo/echo-ui']
	}
});
