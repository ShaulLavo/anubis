import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
	},
	define: {
		'import.meta.env.MODE': '"test"',
		'import.meta.env.DEV': 'false',
		'import.meta.env.VITE_API_ORIGIN': 'undefined',
		'import.meta.env.VITE_SERVER_PORT': '3001',
	},
})