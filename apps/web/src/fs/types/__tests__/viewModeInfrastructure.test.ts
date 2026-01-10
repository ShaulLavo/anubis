import { describe, it, expect } from 'vitest'
import { createMinimalBinaryParseResult } from '@repo/utils'
import {
	detectAvailableViewModes,
	getDefaultViewMode,
	supportsMultipleViewModes,
	isViewModeValid,
	getValidViewMode,
	isRegularFile,
} from '../../utils/viewModeDetection'

describe('ViewModeRegistry', () => {
	it('detects editor mode for all files', () => {
		const modes = detectAvailableViewModes('/test/file.txt')
		expect(modes).toContain('editor')
	})

	it('detects UI mode for settings files', () => {
		// With leading slash
		const modes = detectAvailableViewModes('/.system/userSettings.json')
		expect(modes).toContain('ui')
		expect(modes).toContain('editor')
		
		// Without leading slash (tree node format)
		const modesNoSlash = detectAvailableViewModes('.system/userSettings.json')
		expect(modesNoSlash).toContain('ui')
		expect(modesNoSlash).toContain('editor')
	})

	it('detects binary mode for binary files', () => {
		const mockStats = createMinimalBinaryParseResult('', {
			isText: false,
			confidence: 'high',
		})
		const modes = detectAvailableViewModes('/test/binary.exe', mockStats)
		expect(modes).toContain('binary')
		expect(modes).toContain('editor')
	})

	it('returns editor as default mode for regular files', () => {
		const defaultMode = getDefaultViewMode('/test/file.txt')
		expect(defaultMode).toBe('editor')
	})

	it('detects multiple view modes correctly', () => {
		expect(supportsMultipleViewModes('/test/file.txt')).toBe(false)
		expect(supportsMultipleViewModes('/.system/userSettings.json')).toBe(true)

		const mockStats = createMinimalBinaryParseResult('', {
			isText: false,
			confidence: 'high',
		})
		expect(supportsMultipleViewModes('/test/binary.exe', mockStats)).toBe(true)
	})

	it('validates view modes correctly', () => {
		expect(isViewModeValid('editor', '/test/file.txt')).toBe(true)
		expect(isViewModeValid('ui', '/test/file.txt')).toBe(false)
		expect(isViewModeValid('ui', '/.system/userSettings.json')).toBe(true)

		const mockStats = createMinimalBinaryParseResult('', {
			isText: false,
			confidence: 'high',
		})
		expect(isViewModeValid('binary', '/test/binary.exe', mockStats)).toBe(true)
		expect(isViewModeValid('binary', '/test/file.txt')).toBe(false)
	})

	it('handles invalid view mode requests with fallback (Requirements 4.4, 6.1, 6.3, 6.4)', () => {
		// Regular file - should fallback to editor when requesting unavailable mode
		expect(getValidViewMode('ui', '/test/file.txt')).toBe('editor')
		expect(getValidViewMode('binary', '/test/file.txt')).toBe('editor')
		
		// Settings file - should allow valid modes
		expect(getValidViewMode('ui', '/.system/userSettings.json')).toBe('ui')
		expect(getValidViewMode('editor', '/.system/userSettings.json')).toBe('editor')
		
		// Binary file - should default to editor mode (Requirement 4.4)
		const mockStats = createMinimalBinaryParseResult('', {
			isText: false,
			confidence: 'high',
		})
		expect(getValidViewMode('binary', '/test/binary.exe', mockStats)).toBe('binary')
		expect(getValidViewMode('editor', '/test/binary.exe', mockStats)).toBe('editor')
		// Invalid mode should fallback to default (editor for binary files)
		expect(getValidViewMode('ui', '/test/binary.exe', mockStats)).toBe('editor')
	})

	it('identifies regular files correctly (Requirements 6.1, 6.3, 6.4)', () => {
		// Regular files should only support editor mode
		expect(isRegularFile('/test/file.txt')).toBe(true)
		expect(isRegularFile('/test/document.md')).toBe(true)
		
		// Settings files support multiple modes
		expect(isRegularFile('/.system/userSettings.json')).toBe(false)
		
		// Binary files support multiple modes
		const mockStats = createMinimalBinaryParseResult('', {
			isText: false,
			confidence: 'high',
		})
		expect(isRegularFile('/test/binary.exe', mockStats)).toBe(false)
	})
})
