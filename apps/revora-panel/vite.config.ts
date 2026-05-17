import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		// Force Vite to transform workspace packages during SSR (not pass them
		// through to Node's native ESM resolver). Necessary because our shared
		// packages use TypeScript `.js` import suffixes that only work under
		// bundler resolution, not Node's native module resolution.
		noExternal: ['@revora/review-core', '@revora/review-ui']
	}
});
