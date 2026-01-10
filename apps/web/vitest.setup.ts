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

// Mock window object
Object.defineProperty(global, 'window', {
	value: {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		location: {
			href: 'http://localhost:3000',
			origin: 'http://localhost:3000',
		},
	},
	writable: true,
})

// Mock document object
Object.defineProperty(global, 'document', {
	value: {
		fonts: {
			add: vi.fn(),
		},
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	},
	writable: true,
})