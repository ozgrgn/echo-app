import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries (e.g. @revora/review-ui).
		// Library packages may still use Svelte 4 syntax; this leaves them alone.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-node — for Railway / generic Node hosting (see spec §11)
		adapter: adapter()
	}
};

export default config;
