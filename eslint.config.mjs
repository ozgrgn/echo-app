import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './apps/echo-panel/svelte.config.js';

export default defineConfig(
	{
		ignores: [
			'**/build/**',
			'**/dist/**',
			'**/.svelte-kit/**',
			'**/node_modules/**',
			'**/coverage/**'
		]
	},
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		rules: {
			'no-debugger': 'error',
			'no-duplicate-imports': 'error',
			'no-template-curly-in-string': 'error',
			'no-unreachable-loop': 'error',
			'no-unused-private-class-members': 'error'
		}
	}
);
