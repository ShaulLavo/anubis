import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ParseResult } from '@repo/utils'
import { 
	detectAvailableViewModes, 
	getDefaultViewMode, 
	getValidViewMode,
	isViewModeValid
} from '../utils/viewModeDetection'

/**
 * Property-based tests for view mode detection consistency
 * **Feature: file-view-modes, Property 4: View Mode Detection Consistency**
 * **Validates: Requirements 6.5, 4.3, 3.3**
 */
describe('View Mode Detection Consistency Properties', () => {
	/**
	 * Property 4: View Mode Detection Consistency
	 * For any file path, view mode detection should be deterministic and consistent
	 * **Validates: Requirements 6.5, 4.3, 3.3**
	 */
	it('property: view mode detection is deterministic and consistent', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.oneof(
						// Regular files
						fc.constantFrom(
							'document.txt',
							'script.js',
							'style.css',
							'readme.md',
							'config.yaml',
							'data.xml'
						),
						// Settings files
						fc.constantFrom(
							'.system/settings.json',
							'.system/userSettings.json'
						),
						// Generated file paths
						fc.tuple(
							fc.constantFrom('test', 'file', 'document'),
							fc.constantFrom('.txt', '.js', '.json')
						).map(([name, ext]) => `${name}${ext}`)
					),
					// Add stats for binary file testing
					stats: fc.option(
						fc.record({
							contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<'text' | 'binary'>,
						})
					),
				}),
				(config) => {
					const stats = config.stats as ParseResult | undefined
					
					// Detection should be deterministic - same input, same output
					const modes1 = detectAvailableViewModes(config.filePath, stats)
					const modes2 = detectAvailableViewModes(config.filePath, stats)
					expect(modes1).toEqual(modes2)

					const default1 = getDefaultViewMode(config.filePath, stats)
					const default2 = getDefaultViewMode(config.filePath, stats)
					expect(default1).toBe(default2)

					// All files should have at least editor mode
					expect(modes1).toContain('editor')
					
					// Default mode should be one of available modes
					expect(modes1).toContain(default1)
					
					// Default mode should be 'editor' for all files (per requirements)
					expect(default1).toBe('editor')
					
					// Settings files should have both editor and ui modes
					if (config.filePath.includes('.system/') && config.filePath.endsWith('.json')) {
						expect(modes1).toContain('editor')
						expect(modes1).toContain('ui')
						
						// If also binary, will have 3 modes, otherwise 2
						if (stats?.contentKind === 'binary') {
							expect(modes1).toContain('binary')
							expect(modes1.length).toBe(3)
						} else {
							expect(modes1.length).toBe(2)
						}
					}
					
					// Binary files should have editor and binary modes
					else if (stats?.contentKind === 'binary') {
						expect(modes1).toContain('editor')
						expect(modes1).toContain('binary')
						expect(modes1.length).toBe(2)
					}
					
					// Regular files (non-binary, non-settings) should only have editor mode
					else {
						expect(modes1).toEqual(['editor'])
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: view mode validation is consistent with detection', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom(
						'test.txt',
						'.system/settings.json'
					),
					requestedMode: fc.constantFrom('editor', 'ui', 'binary', 'invalid'),
					stats: fc.option(
						fc.record({
							contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<'text' | 'binary'>,
						})
					),
				}),
				(config) => {
					const stats = config.stats as ParseResult | undefined
					const availableModes = detectAvailableViewModes(config.filePath, stats)
					const isValid = isViewModeValid(config.requestedMode, config.filePath, stats)
					const validatedMode = getValidViewMode(config.requestedMode, config.filePath, stats)

					// Validation should be consistent with detection
					if (availableModes.includes(config.requestedMode)) {
						expect(isValid).toBe(true)
						expect(validatedMode).toBe(config.requestedMode)
					} else {
						expect(isValid).toBe(false)
						expect(validatedMode).not.toBe(config.requestedMode)
						expect(availableModes).toContain(validatedMode)
					}

					// Validated mode should always be available
					expect(availableModes).toContain(validatedMode)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: file type classification is consistent', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					// Test each file type category with proper stats
					{ path: 'test.txt', type: 'regular', stats: { contentKind: 'text' as const } },
					{ path: '.system/settings.json', type: 'settings', stats: { contentKind: 'text' as const } },
					{ path: 'binary.exe', type: 'binary', stats: { contentKind: 'binary' as const } }
				),
				(config) => {
					const stats = config.stats as ParseResult
					const availableModes = detectAvailableViewModes(config.path, stats)
					
					switch (config.type) {
						case 'regular':
							expect(availableModes).toEqual(['editor'])
							break
						case 'settings':
							expect(availableModes).toContain('editor')
							expect(availableModes).toContain('ui')
							expect(availableModes.length).toBe(2)
							break
						case 'binary':
							expect(availableModes).toContain('editor')
							expect(availableModes).toContain('binary')
							expect(availableModes.length).toBe(2)
							break
					}
				}
			),
			{ numRuns: 100 }
		)
	})
})