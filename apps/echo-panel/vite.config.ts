import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Preferred port; if it's taken (e.g. another project's dev server), Vite
		// falls through to the next free port instead of erroring out.
		port: 5173,
		// Dev-only CORS bypass: Vite's Node proxy forwards /v1/* server-to-server,
		// so the browser never makes a cross-origin request and CORS doesn't apply.
		// Set PUBLIC_ECHO_API_URL=/v1 in .env.local to route through here.
		//   local backend (now points at Atlas `echo` DB) → target: 'http://localhost:3001'
		//   production echo-api → target: 'https://echo-api-production-b3a5.up.railway.app'
		proxy: {
			'/v1': {
				// Local dev → production echo-api (local backend on :3001 is usually not
				// running; prod has the live Atlas `echo` data). Swap back to
				// 'http://localhost:3001' only when running echo-backend locally.
				target: 'https://echo-api-production-b3a5.up.railway.app',
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
