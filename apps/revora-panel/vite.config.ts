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
		port: 5173
	},
	ssr: {
		// Force Vite to transform workspace packages during SSR (not pass them
		// through to Node's native ESM resolver). Necessary because our shared
		// packages use TypeScript `.js` import suffixes that only work under
		// bundler resolution, not Node's native module resolution.
		noExternal: ['@revora/review-core', '@revora/review-ui']
	}
});
