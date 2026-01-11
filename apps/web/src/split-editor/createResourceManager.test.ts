import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { createResourceManager } from './createResourceManager'
import type { ResourceManager, TextEdit } from './createResourceManager'

/**
 * Property-based tests for Split Editor Resource Manager
 * **Feature: split-editor**
 */
describe('Resource Manager Properties', () => {
	let resourceManager: ResourceManager

	beforeEach(() => {
		resourceManager = createResourceManager()
	})

	/**
	 * Helper: Generate a valid file path
	 */
	const filePathArb = fc.stringMatching(/^[a-z][a-z0-9_-]*\.(ts|js|tsx|jsx|json|md)$/)

	/**
	 * Helper: Generate a valid pane ID (UUID-like)
	 */
	const paneIdArb = fc.uuid()

	/**
	 * Property 4: Resource Sharing Consistency
	 * For any file open in multiple panes, all panes SHALL share the same tree-sitter worker
	 * instance and syntax highlighting state, and edits in one pane SHALL be reflected in
	 * all other panes showing the same file.
	 * **Validates: Requirements 2.1, 2.2, 2.5**
	 */
	it('property: resource sharing consistency across multiple panes', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: filePathArb,
					paneIds: fc.array(paneIdArb, { minLength: 2, maxLength: 5 }),
				}),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					const { filePath, paneIds } = config

					// Register all panes for the same file
					for (const paneId of paneIds) {
						resourceManager.registerPaneForFile(paneId, filePath)
					}

					// Verify all panes share the same buffer instance
					const buffer1 = resourceManager.getBuffer(filePath)
					expect(buffer1).toBeDefined()
					if (!buffer1) return

					// Get buffer again - should be the same instance
					const buffer2 = resourceManager.getBuffer(filePath)
					expect(buffer2).toBe(buffer1)

					// Verify all panes share the same highlight state
					const highlights1 = resourceManager.getHighlightState(filePath)
					expect(highlights1).toBeDefined()
					if (!highlights1) return

					const highlights2 = resourceManager.getHighlightState(filePath)
					expect(highlights2).toBe(highlights1)

					// Verify pane count is correct
					expect(resourceManager.getPaneCountForFile(filePath)).toBe(paneIds.length)

					// Verify file is tracked
					expect(resourceManager.hasResourcesForFile(filePath)).toBe(true)
					expect(resourceManager.getTrackedFiles()).toContain(filePath)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 4 (continued): Edits in one pane are reflected in all panes
	 * **Validates: Requirements 2.5**
	 */
	it('property: edits are coordinated across panes showing same file', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: filePathArb,
					paneIds: fc.array(paneIdArb, { minLength: 2, maxLength: 4 }),
					initialContent: fc.string({ minLength: 0, maxLength: 100 }),
					insertText: fc.string({ minLength: 1, maxLength: 20 }),
				}),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					const { filePath, paneIds, initialContent, insertText } = config

					// Register all panes
					for (const paneId of paneIds) {
						resourceManager.registerPaneForFile(paneId, filePath)
					}

					const buffer = resourceManager.getBuffer(filePath)
					expect(buffer).toBeDefined()
					if (!buffer) return

					// Set initial content
					buffer.setContent(initialContent)
					expect(buffer.content()).toBe(initialContent)

					// Track edit notifications
					const editNotifications: TextEdit[] = []
					const unsubscribe = buffer.onEdit((edit) => {
						editNotifications.push(edit)
					})

					// Apply an edit (synchronously test the content update and notification)
					const edit: TextEdit = {
						startIndex: 0,
						oldEndIndex: 0,
						newEndIndex: insertText.length,
						startPosition: { row: 0, column: 0 },
						oldEndPosition: { row: 0, column: 0 },
						newEndPosition: { row: 0, column: insertText.length },
						insertedText: insertText,
					}

					// Call applyEdit but don't await - we're testing the synchronous parts
					void buffer.applyEdit(edit)

					// Verify content was updated synchronously
					expect(buffer.content()).toBe(insertText + initialContent)

					// Verify edit notification was sent synchronously
					expect(editNotifications.length).toBe(1)
					expect(editNotifications[0]).toEqual(edit)

					// Cleanup
					unsubscribe()
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 4 (continued): Different files use separate resources
	 * **Validates: Requirements 2.3**
	 */
	it('property: different files have separate resources', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath1: filePathArb,
					filePath2: filePathArb,
					paneId1: paneIdArb,
					paneId2: paneIdArb,
				}).filter((c) => c.filePath1 !== c.filePath2),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					const { filePath1, filePath2, paneId1, paneId2 } = config

					// Register panes for different files
					resourceManager.registerPaneForFile(paneId1, filePath1)
					resourceManager.registerPaneForFile(paneId2, filePath2)

					// Verify separate buffers
					const buffer1 = resourceManager.getBuffer(filePath1)
					const buffer2 = resourceManager.getBuffer(filePath2)

					expect(buffer1).toBeDefined()
					expect(buffer2).toBeDefined()
					expect(buffer1).not.toBe(buffer2)

					// Verify separate highlight states
					const highlights1 = resourceManager.getHighlightState(filePath1)
					const highlights2 = resourceManager.getHighlightState(filePath2)

					expect(highlights1).toBeDefined()
					expect(highlights2).toBeDefined()
					expect(highlights1).not.toBe(highlights2)

					// Verify both files are tracked
					expect(resourceManager.getTrackedFiles()).toContain(filePath1)
					expect(resourceManager.getTrackedFiles()).toContain(filePath2)
					expect(resourceManager.getTrackedFiles().length).toBe(2)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 5: Resource Cleanup
	 * For any file, when the last pane showing that file is closed, the associated
	 * tree-sitter worker and syntax highlighting state SHALL be cleaned up.
	 * **Validates: Requirements 2.4**
	 */
	it('property: resources are cleaned up when last pane is unregistered', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: filePathArb,
					paneIds: fc.array(paneIdArb, { minLength: 1, maxLength: 5 }),
				}),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					const { filePath, paneIds } = config

					// Register all panes
					for (const paneId of paneIds) {
						resourceManager.registerPaneForFile(paneId, filePath)
					}

					// Verify resources exist
					expect(resourceManager.hasResourcesForFile(filePath)).toBe(true)
					expect(resourceManager.getPaneCountForFile(filePath)).toBe(paneIds.length)

					// Unregister panes one by one
					for (let i = 0; i < paneIds.length; i++) {
						const paneId = paneIds[i]
						if (!paneId) continue

						resourceManager.unregisterPaneFromFile(paneId, filePath)

						const remainingPanes = paneIds.length - i - 1

						if (remainingPanes > 0) {
							// Resources should still exist
							expect(resourceManager.hasResourcesForFile(filePath)).toBe(true)
							expect(resourceManager.getPaneCountForFile(filePath)).toBe(remainingPanes)
						} else {
							// Last pane unregistered - resources should be cleaned up
							expect(resourceManager.hasResourcesForFile(filePath)).toBe(false)
							expect(resourceManager.getPaneCountForFile(filePath)).toBe(0)
							expect(resourceManager.getBuffer(filePath)).toBeUndefined()
							expect(resourceManager.getHighlightState(filePath)).toBeUndefined()
							expect(resourceManager.getTrackedFiles()).not.toContain(filePath)
						}
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 5 (continued): Cleanup is idempotent
	 * **Validates: Requirements 2.4**
	 */
	it('property: unregistering non-existent pane is safe', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: filePathArb,
					paneId: paneIdArb,
					nonExistentPaneId: paneIdArb,
				}).filter((c) => c.paneId !== c.nonExistentPaneId),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					const { filePath, paneId, nonExistentPaneId } = config

					// Register one pane
					resourceManager.registerPaneForFile(paneId, filePath)
					expect(resourceManager.getPaneCountForFile(filePath)).toBe(1)

					// Unregister a non-existent pane - should be safe
					resourceManager.unregisterPaneFromFile(nonExistentPaneId, filePath)

					// Original pane should still be registered
					expect(resourceManager.getPaneCountForFile(filePath)).toBe(1)
					expect(resourceManager.hasResourcesForFile(filePath)).toBe(true)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 5 (continued): Unregistering from non-existent file is safe
	 * **Validates: Requirements 2.4**
	 */
	it('property: unregistering from non-existent file is safe', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: filePathArb,
					paneId: paneIdArb,
				}),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					const { filePath, paneId } = config

					// Unregister from a file that was never registered - should be safe
					expect(() => {
						resourceManager.unregisterPaneFromFile(paneId, filePath)
					}).not.toThrow()

					// No resources should exist
					expect(resourceManager.hasResourcesForFile(filePath)).toBe(false)
					expect(resourceManager.getTrackedFiles().length).toBe(0)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property: Global cleanup removes all resources
	 */
	it('property: cleanup removes all tracked resources', () => {
		fc.assert(
			fc.property(
				fc.record({
					files: fc.array(
						fc.record({
							filePath: filePathArb,
							paneIds: fc.array(paneIdArb, { minLength: 1, maxLength: 3 }),
						}),
						{ minLength: 1, maxLength: 5 }
					),
				}),
				(config) => {
					// Reset resource manager
					resourceManager = createResourceManager()

					// Register multiple files with multiple panes
					for (const file of config.files) {
						for (const paneId of file.paneIds) {
							resourceManager.registerPaneForFile(paneId, file.filePath)
						}
					}

					// Verify resources exist
					const uniqueFiles = [...new Set(config.files.map((f) => f.filePath))]
					expect(resourceManager.getTrackedFiles().length).toBe(uniqueFiles.length)

					// Cleanup all
					resourceManager.cleanup()

					// Verify all resources are gone
					expect(resourceManager.getTrackedFiles().length).toBe(0)
					for (const file of config.files) {
						expect(resourceManager.hasResourcesForFile(file.filePath)).toBe(false)
						expect(resourceManager.getBuffer(file.filePath)).toBeUndefined()
						expect(resourceManager.getHighlightState(file.filePath)).toBeUndefined()
					}
				}
			),
			{ numRuns: 100 }
		)
	})
})
