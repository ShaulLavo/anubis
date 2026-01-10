import { describe, it, expect, beforeEach } from 'vitest'
import { ViewModeRegistry, viewModeRegistry } from '../registry/ViewModeRegistry'
import { detectAvailableViewModes, getDefaultViewMode } from '../utils/viewModeDetection'

describe('View Mode Extensibility Infrastructure', () => {
	let testRegistry: ViewModeRegistry

	beforeEach(() => {
		// Create a fresh registry for each test
		testRegistry = new ViewModeRegistry()
	})

	describe('ViewModeRegistry', () => {
		it('should register and retrieve view modes', () => {
			testRegistry.register({
				id: 'test',
				label: 'Test Mode',
				icon: 'test-icon',
				isAvailable: () => true,
			})

			const mode = testRegistry.getViewMode('test')
			expect(mode).toBeDefined()
			expect(mode?.label).toBe('Test Mode')
		})

		it('should detect available modes for files', () => {
			testRegistry.register({
				id: 'editor',
				label: 'Editor',
				isAvailable: () => true,
				isDefault: true,
			})

			testRegistry.register({
				id: 'preview',
				label: 'Preview',
				isAvailable: (path) => path.endsWith('.md'),
			})

			const mdModes = testRegistry.getAvailableModes('test.md')
			const txtModes = testRegistry.getAvailableModes('test.txt')

			expect(mdModes).toHaveLength(2)
			expect(txtModes).toHaveLength(1)
		})

		it('should return correct default mode', () => {
			testRegistry.register({
				id: 'editor',
				label: 'Editor',
				isAvailable: () => true,
				isDefault: true,
			})

			testRegistry.register({
				id: 'ui',
				label: 'UI',
				isAvailable: (path) => path.includes('settings'),
			})

			const defaultForRegular = testRegistry.getDefaultMode('test.txt')
			const defaultForSettings = testRegistry.getDefaultMode('settings.json')

			expect(defaultForRegular).toBe('editor')
			expect(defaultForSettings).toBe('editor') // editor is marked as default
		})

		it('should initialize built-in modes', () => {
			testRegistry.initialize()

			const allModes = testRegistry.getAllModes()
			expect(allModes.length).toBeGreaterThan(0)

			const editorMode = testRegistry.getViewMode('editor')
			expect(editorMode).toBeDefined()
			expect(editorMode?.isDefault).toBe(true)
		})

		it('should support extensibility with custom modes', () => {
			testRegistry.initialize()

			// Add a custom mode
			testRegistry.register({
				id: 'diagram',
				label: 'Diagram',
				icon: 'diagram',
				isAvailable: (path) => path.endsWith('.mermaid'),
				stateHooks: {
					createState: () => ({ zoom: 1 }),
					cleanup: () => {},
				},
			})

			const diagramMode = testRegistry.getViewMode('diagram')
			expect(diagramMode).toBeDefined()
			expect(diagramMode?.stateHooks).toBeDefined()

			const availableForMermaid = testRegistry.getAvailableModes('test.mermaid')
			expect(availableForMermaid.some(mode => mode.id === 'diagram')).toBe(true)
		})
	})

	describe('Global Registry Integration', () => {
		it('should have built-in modes available', () => {
			const editorMode = viewModeRegistry.getViewMode('editor')
			const uiMode = viewModeRegistry.getViewMode('ui')
			const binaryMode = viewModeRegistry.getViewMode('binary')

			expect(editorMode).toBeDefined()
			expect(uiMode).toBeDefined()
			expect(binaryMode).toBeDefined()
		})

		it('should detect modes for different file types', () => {
			const regularFile = detectAvailableViewModes('test.txt')
			const settingsFile = detectAvailableViewModes('.system/settings.json')

			expect(regularFile).toContain('editor')
			expect(settingsFile).toContain('editor')
			expect(settingsFile).toContain('ui')
		})

		it('should return correct defaults', () => {
			const defaultForRegular = getDefaultViewMode('test.txt')
			const defaultForSettings = getDefaultViewMode('.system/settings.json')

			expect(defaultForRegular).toBe('editor')
			expect(defaultForSettings).toBe('editor') // editor is default even for settings
		})
	})

	describe('Requirements Compliance', () => {
		it('should satisfy Requirement 7.1: Clear interface for registering new view modes', () => {
			// Test that the registry provides a clear registration interface
			expect(() => {
				testRegistry.register({
					id: 'custom',
					label: 'Custom Mode',
					isAvailable: () => true,
				})
			}).not.toThrow()

			const customMode = testRegistry.getViewMode('custom')
			expect(customMode).toBeDefined()
		})

		it('should satisfy Requirement 7.3: Extensible through configuration', () => {
			testRegistry.initialize()
			const initialCount = testRegistry.getAllModes().length

			// Add new mode
			testRegistry.register({
				id: 'new-mode',
				label: 'New Mode',
				isAvailable: () => true,
			})

			const finalCount = testRegistry.getAllModes().length
			expect(finalCount).toBe(initialCount + 1)
		})

		it('should satisfy Requirement 7.4: Consistent behavior patterns', () => {
			testRegistry.initialize()

			// All modes should have consistent structure
			const allModes = testRegistry.getAllModes()
			for (const mode of allModes) {
				expect(mode.id).toBeDefined()
				expect(mode.label).toBeDefined()
				expect(typeof mode.isAvailable).toBe('function')
			}
		})

		it('should satisfy Requirement 7.5: Hooks for view mode-specific state management', () => {
			testRegistry.register({
				id: 'stateful',
				label: 'Stateful Mode',
				isAvailable: () => true,
				stateHooks: {
					createState: () => ({ data: 'test' }),
					cleanup: (state) => {
						// Cleanup logic
					},
				},
			})

			const mode = testRegistry.getViewMode('stateful')
			expect(mode?.stateHooks).toBeDefined()
			expect(mode?.stateHooks?.createState).toBeDefined()
			expect(mode?.stateHooks?.cleanup).toBeDefined()
		})
	})
})