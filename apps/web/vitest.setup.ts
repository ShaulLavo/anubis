import { vi } from 'vitest'

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
	value: {
		MODE: 'test',
		DEV: false,
		VITE_API_ORIGIN: undefined,
		VITE_SERVER_PORT: 3001,
	},
	writable: true,
})

// Mock browser APIs that might be missing in test environment
global.localStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	length: 0,
	key: vi.fn(),
}

global.sessionStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	length: 0,
	key: vi.fn(),
}

// Extend window object with any missing methods (don't replace it)
if (typeof window !== 'undefined') {
	// Add any missing properties needed for tests
	if (!window.location) {
		Object.defineProperty(window, 'location', {
			value: {
				href: 'http://localhost:3000',
				origin: 'http://localhost:3000',
			},
			writable: true,
		})
	}
}

// Mock document.fonts if not present (extend, don't replace document)
if (typeof document !== 'undefined' && !document.fonts) {
	Object.defineProperty(document, 'fonts', {
		value: {
			add: vi.fn(),
		},
		writable: true,
	})
}