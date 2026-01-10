import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { ViewModeRegistry } from '../registry/ViewModeRegistry'
import type { ViewMode } from '../types/ViewMode'

/**
 * Property-based tests for view mode registry extensibility
 * **Feature: file-view-modes, Property 15: View Mode Registry Extensibility**
 * **Validates: Requirements 7.1, 7.3**
 */
describe('View Mode Registry Extensibility Properties', () => {
	let registry: ViewModeRegistry

	beforeEach(() => {
		registry = new ViewModeRegistry()
		registry.initialize() // Start with built-in modes
	})

	/**
	 * Property 15: View Mode Registry Extensibility
	 * For any new view mode registered in the system, it should be available for files that match its availability criteria
	 * **Validates: Requirements 7.1, 7.3**
	 */
	it('property: registry extensibility - registered modes are available for matching files', () => {
		fc.assert(
			fc.property(
				// Generate arbitrary view mode definitions
				fc.record({
					id: fc.constantFrom('custom1', 'custom2', 'preview', 'diagram', 'chart'),
					label: fc.string({ minLength: 1, maxLength: 20 }),
					icon: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
					fileExtension: fc.constantFrom('.md', '.txt', '.json', '.xml', '.csv'),
					isDefault: fc.boolean(),
				}),
				(modeConfig) => {
					// Register the custom view mode
					registry.register({
						id: modeConfig.id,
						label: modeConfig.label,
						icon: modeConfig.icon ?? undefined,
						isAvailable: (path) => path.endsWith(modeConfig.fileExtension),
						isDefault: modeConfig.isDefault,
					})

					// Test that the mode is available for matching files
					const matchingFile = `test${modeConfig.fileExtension}`
					const nonMatchingFile = 'test.other'

					const availableForMatching = registry.getAvailableModes(matchingFile)
					const availableForNonMatching = registry.getAvailableModes(nonMatchingFile)

					// The registered mode should be available for matching files
					const isAvailableForMatching = availableForMatching.some(
						mode => mode.id === modeConfig.id
					)
					expect(isAvailableForMatching).toBe(true)

					// The registered mode should not be available for non-matching files
					const isAvailableForNonMatching = availableForNonMatching.some(
						mode => mode.id === modeConfig.id
					)
					expect(isAvailableForNonMatching).toBe(false)

					// The mode should be retrievable by ID
					const retrievedMode = registry.getViewMode(modeConfig.id)
					expect(retrievedMode).toBeDefined()
					expect(retrievedMode?.label).toBe(modeConfig.label)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: registry maintains consistency after multiple registrations', () => {
		fc.assert(
			fc.property(
				// Generate multiple view mode registrations
				fc.array(
					fc.record({
						id: fc.integer({ min: 1, max: 10 }).map(n => `mode${n}`),
						label: fc.string({ minLength: 1, maxLength: 15 }),
						pattern: fc.constantFrom('*.md', '*.json', '*.txt', '*.xml'),
					}),
					{ minLength: 1, maxLength: 5 }
				),
				(modeConfigs) => {
					const initialModeCount = registry.getAllModes().length

					// Register all modes
					for (const config of modeConfigs) {
						registry.register({
							id: config.id,
							label: config.label,
							isAvailable: (path) => {
								const pattern = config.pattern.replace('*', '')
								return path.endsWith(pattern)
							},
						})
					}

					// Verify all modes were registered
					const finalModeCount = registry.getAllModes().length
					const uniqueIds = new Set(modeConfigs.map(c => c.id))
					
					// Should have initial modes plus unique new modes
					expect(finalModeCount).toBeGreaterThanOrEqual(initialModeCount)
					expect(finalModeCount).toBeLessThanOrEqual(initialModeCount + uniqueIds.size)

					// Verify each unique mode is retrievable and functional
					for (const uniqueId of uniqueIds) {
						const mode = registry.getViewMode(uniqueId)
						expect(mode).toBeDefined()
						
						// Find the config for this ID (use the last one if duplicates)
						const config = modeConfigs.filter(c => c.id === uniqueId).pop()!
						expect(mode?.label).toBe(config.label)

						// Test availability logic
						const testFile = `test${config.pattern.replace('*', '')}`
						const isAvailable = registry.isViewModeAvailable(uniqueId, testFile)
						expect(isAvailable).toBe(true)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: registry handles duplicate registrations correctly', () => {
		fc.assert(
			fc.property(
				fc.record({
					id: fc.constantFrom('duplicate1', 'duplicate2', 'duplicate3'),
					firstLabel: fc.string({ minLength: 1, maxLength: 10 }),
					secondLabel: fc.string({ minLength: 1, maxLength: 10 }),
					extension: fc.constantFrom('.md', '.txt', '.json'),
				}),
				(config) => {
					const initialCount = registry.getAllModes().length

					// Register the same mode twice with different labels
					registry.register({
						id: config.id,
						label: config.firstLabel,
						isAvailable: (path) => path.endsWith(config.extension),
					})

					registry.register({
						id: config.id,
						label: config.secondLabel,
						isAvailable: (path) => path.endsWith(config.extension),
					})

					// Should only have one additional mode (second registration overwrites first)
					const finalCount = registry.getAllModes().length
					expect(finalCount).toBeGreaterThanOrEqual(initialCount)
					expect(finalCount).toBeLessThanOrEqual(initialCount + 1)

					// Should have the second label (last registration wins)
					const mode = registry.getViewMode(config.id)
					expect(mode?.label).toBe(config.secondLabel)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: registry state hooks are preserved and functional', () => {
		fc.assert(
			fc.property(
				fc.record({
					id: fc.constantFrom('stateful1', 'stateful2', 'stateful3'),
					label: fc.string({ minLength: 1, maxLength: 10 }),
					hasStateHooks: fc.boolean(),
					stateValue: fc.string({ minLength: 1, maxLength: 10 }),
				}),
				(config) => {
					const stateHooks = config.hasStateHooks ? {
						createState: () => ({ value: config.stateValue }),
						cleanup: (state: any) => {
							// Cleanup logic
							state.cleaned = true
						},
					} : undefined

					registry.register({
						id: config.id,
						label: config.label,
						isAvailable: () => true,
						stateHooks,
					})

					const mode = registry.getViewMode(config.id)
					expect(mode).toBeDefined()

					if (config.hasStateHooks) {
						expect(mode?.stateHooks).toBeDefined()
						expect(mode?.stateHooks?.createState).toBeDefined()
						expect(mode?.stateHooks?.cleanup).toBeDefined()

						// Test state creation
						const state = mode?.stateHooks?.createState?.()
						expect(state).toEqual({ value: config.stateValue })

						// Test cleanup
						if (state && mode?.stateHooks?.cleanup) {
							mode.stateHooks.cleanup(state)
							expect(state.cleaned).toBe(true)
						}
					} else {
						expect(mode?.stateHooks).toBeUndefined()
					}
				}
			),
			{ numRuns: 100 }
		)
	})
})