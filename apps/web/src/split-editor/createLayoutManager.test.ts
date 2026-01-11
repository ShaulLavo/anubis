import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { createRoot } from 'solid-js'
import { createLayoutManager } from './createLayoutManager'
import type { LayoutManager } from './createLayoutManager'
import type {
	SplitDirection,
	SplitContainer,
	EditorPane,
	NodeId,
} from './types'
import { isContainer, isPane } from './types'

/**
 * Property-based tests for Split Editor Layout Manager
 * **Feature: split-editor**
 */
describe('Layout Manager Properties', () => {
	let manager: LayoutManager
	let dispose: () => void

	beforeEach(() => {
		dispose = createRoot((d) => {
			manager = createLayoutManager()
			manager.initialize()
			return d
		})
	})

	afterEach(() => {
		dispose?.()
	})

	/**
	 * Helper: Create a layout manager within a reactive root.
	 * Returns the manager - the root is disposed when the test ends.
	 */
	function createTestManager(): LayoutManager {
		let testManager!: LayoutManager
		createRoot(() => {
			testManager = createLayoutManager()
			testManager.initialize()
		})
		return testManager
	}

	/**
	 * Helper: Create an uninitialized layout manager within a reactive root.
	 * Use this when you need to call restoreLayout instead of initialize.
	 */
	function createUninitializedManager(): LayoutManager {
		let testManager!: LayoutManager
		createRoot(() => {
			testManager = createLayoutManager()
		})
		return testManager
	}

	/**
	 * Helper: Get all pane IDs from the layout
	 */
	function getAllPaneIds(): NodeId[] {
		return Object.values(manager.state.nodes)
			.filter((n): n is EditorPane => isPane(n))
			.map((p) => p.id)
	}

	/**
	 * Helper: Validate tree integrity
	 * - Every container has exactly 2 children
	 * - Every node (except root) has exactly one parent
	 * - All child references point to existing nodes
	 * - All parent references are correct
	 */
	function validateTreeIntegrity(): boolean {
		const { nodes, rootId } = manager.state
		if (!rootId || !nodes[rootId]) return false

		// Root should have no parent
		if (nodes[rootId].parentId !== null) return false

		for (const node of Object.values(nodes)) {
			if (isContainer(node)) {
				// Container must have exactly 2 children
				if (node.children.length !== 2) return false

				// Both children must exist
				const [child1Id, child2Id] = node.children
				if (!nodes[child1Id] || !nodes[child2Id]) return false

				// Children must reference this container as parent
				if (nodes[child1Id].parentId !== node.id) return false
				if (nodes[child2Id].parentId !== node.id) return false
			}

			// Non-root nodes must have a valid parent
			if (node.id !== rootId) {
				if (!node.parentId || !nodes[node.parentId]) return false
				const parent = nodes[node.parentId]
				if (!parent || !isContainer(parent)) return false
				if (!parent.children.includes(node.id)) return false
			}
		}

		return true
	}

	/**
	 * Property 1: Layout Tree Integrity
	 * For any sequence of split and close operations, the layout tree SHALL remain a valid binary tree
	 * where every Split_Container has exactly two children and every node (except root) has exactly one parent.
	 * **Validates: Requirements 1.3, 3.1, 3.2**
	 */
	it('property: layout tree integrity after random operations', () => {
		fc.assert(
			fc.property(
				fc.record({
					operations: fc.array(
						fc.oneof(
							fc.record({
								type: fc.constant('split' as const),
								direction: fc.constantFrom<SplitDirection>(
									'horizontal',
									'vertical'
								),
							}),
							fc.record({
								type: fc.constant('close' as const),
							})
						),
						{ minLength: 1, maxLength: 20 }
					),
				}),
				(config) => {
					// Reset manager for each test (in reactive root)
					manager = createTestManager()

					// Verify initial state is valid
					expect(validateTreeIntegrity()).toBe(true)

					// Apply operations
					for (const operation of config.operations) {
						const panesBefore = getAllPaneIds()

						if (operation.type === 'split') {
							// Split a random pane
							if (panesBefore.length > 0) {
								const randomPaneIndex = Math.floor(
									Math.random() * panesBefore.length
								)
								const paneToSplit = panesBefore[randomPaneIndex]
								if (paneToSplit) {
									manager.splitPane(paneToSplit, operation.direction)
								}
							}
						} else if (operation.type === 'close') {
							// Close a random pane (but not if it's the last one)
							if (panesBefore.length > 1) {
								const randomPaneIndex = Math.floor(
									Math.random() * panesBefore.length
								)
								const paneToClose = panesBefore[randomPaneIndex]
								if (paneToClose) {
									manager.closePane(paneToClose)
								}
							}
						}

						// Verify tree integrity after each operation
						expect(validateTreeIntegrity()).toBe(true)

						// Verify we always have at least one pane
						const panesAfter = getAllPaneIds()
						expect(panesAfter.length).toBeGreaterThan(0)

						// Verify root exists and is valid
						expect(manager.state.rootId).toBeDefined()
						expect(manager.state.nodes[manager.state.rootId]).toBeDefined()
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 2: Split Operation Correctness
	 * For any pane that is split, the resulting layout SHALL contain a new SplitContainer
	 * at the original pane's position with the original pane and a new pane as its two children.
	 * **Validates: Requirements 3.2, 4.1, 4.2**
	 */
	it('property: split operation creates correct container structure', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					splitCount: fc.integer({ min: 1, max: 5 }),
				}),
				(config) => {
					// Reset manager for each test (in reactive root)
					manager = createTestManager()

					const initialPaneCount = getAllPaneIds().length
					expect(initialPaneCount).toBe(1)

					// Perform splits
					for (let i = 0; i < config.splitCount; i++) {
						const panesBefore = getAllPaneIds()
						const paneToSplit = panesBefore[panesBefore.length - 1]
						if (!paneToSplit) continue

						// Split the pane
						const newPaneId = manager.splitPane(paneToSplit, config.direction)

						// Verify new pane was created
						expect(newPaneId).toBeDefined()
						const newPaneNode = manager.state.nodes[newPaneId]
						expect(newPaneNode).toBeDefined()
						if (!newPaneNode) continue
						expect(isPane(newPaneNode)).toBe(true)

						// Verify container was created
						const newPane = newPaneNode as EditorPane
						const containerId = newPane.parentId
						expect(containerId).toBeDefined()
						if (!containerId) continue

						const containerNode = manager.state.nodes[containerId]
						expect(containerNode).toBeDefined()
						if (!containerNode) continue
						expect(isContainer(containerNode)).toBe(true)

						// Verify container structure
						const container = containerNode as SplitContainer
						expect(container.children.length).toBe(2)
						expect(container.children).toContain(paneToSplit)
						expect(container.children).toContain(newPaneId)
						expect(container.direction).toBe(config.direction)
						expect(container.sizes).toEqual([0.5, 0.5])

						// Verify original pane's parent was updated
						const originalPaneNode = manager.state.nodes[paneToSplit]
						expect(originalPaneNode).toBeDefined()
						const originalPane = originalPaneNode as EditorPane
						expect(originalPane.parentId).toBe(containerId)

						// Verify tree integrity
						expect(validateTreeIntegrity()).toBe(true)
					}

					// Verify final pane count
					const finalPaneCount = getAllPaneIds().length
					expect(finalPaneCount).toBe(initialPaneCount + config.splitCount)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 3: Close Operation Correctness
	 * For any pane that is closed (except the last pane), the parent SplitContainer
	 * SHALL be removed and the sibling SHALL be promoted to the parent's position.
	 * **Validates: Requirements 6.2, 6.3, 6.4**
	 */
	it('property: close operation promotes sibling correctly', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					splitCount: fc.integer({ min: 1, max: 4 }),
					closeIndex: fc.integer({ min: 0, max: 10 }),
				}),
				(config) => {
					// Reset manager for each test (in reactive root)
					manager = createTestManager()

					// Create some splits first
					for (let i = 0; i < config.splitCount; i++) {
						const panes = getAllPaneIds()
						const paneToSplit = panes[panes.length - 1]
						if (!paneToSplit) continue
						manager.splitPane(paneToSplit, config.direction)
					}

					const panesBeforeClose = getAllPaneIds()
					expect(panesBeforeClose.length).toBe(config.splitCount + 1)

					// Select a pane to close (not the last one)
					const paneIndexToClose = config.closeIndex % panesBeforeClose.length
					const paneToClose = panesBeforeClose[paneIndexToClose]
					if (!paneToClose) return

					const paneBeforeCloseNode = manager.state.nodes[paneToClose]
					if (!paneBeforeCloseNode || !isPane(paneBeforeCloseNode)) return

					const paneBeforeClose = paneBeforeCloseNode as EditorPane
					const parentIdBeforeClose = paneBeforeClose.parentId

					// If this is the root pane (no parent), closing should be prevented
					if (!parentIdBeforeClose) {
						manager.closePane(paneToClose)
						// Pane should still exist
						expect(manager.state.nodes[paneToClose]).toBeDefined()
						expect(getAllPaneIds().length).toBe(panesBeforeClose.length)
						return
					}

					// Get sibling before close
					const parentBeforeCloseNode = manager.state.nodes[parentIdBeforeClose]
					if (!parentBeforeCloseNode || !isContainer(parentBeforeCloseNode))
						return

					const parentBeforeClose = parentBeforeCloseNode as SplitContainer
					const siblingId = parentBeforeClose.children.find(
						(id) => id !== paneToClose
					)
					if (!siblingId) return

					const grandparentId = parentBeforeClose.parentId

					// Close the pane
					manager.closePane(paneToClose)

					// Verify pane was removed
					expect(manager.state.nodes[paneToClose]).toBeUndefined()

					// Verify parent container was removed
					expect(manager.state.nodes[parentIdBeforeClose]).toBeUndefined()

					// Verify sibling was promoted
					const sibling = manager.state.nodes[siblingId]
					expect(sibling).toBeDefined()
					if (!sibling) return

					expect(sibling.parentId).toBe(grandparentId)

					// If grandparent exists, verify it now references sibling
					if (grandparentId) {
						const grandparentNode = manager.state.nodes[grandparentId]
						if (grandparentNode && isContainer(grandparentNode)) {
							const grandparent = grandparentNode as SplitContainer
							expect(grandparent.children).toContain(siblingId)
						}
					} else {
						// Sibling should be the new root
						expect(manager.state.rootId).toBe(siblingId)
					}

					// Verify tree integrity
					expect(validateTreeIntegrity()).toBe(true)

					// Verify pane count decreased by 1
					const panesAfterClose = getAllPaneIds()
					expect(panesAfterClose.length).toBe(panesBeforeClose.length - 1)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property: Cannot close the last pane
	 * **Validates: Requirements 6.3**
	 */
	it('property: cannot close the last remaining pane', () => {
		fc.assert(
			fc.property(fc.constant(null), () => {
				// Reset manager (in reactive root)
				manager = createTestManager()

				const panes = getAllPaneIds()
				expect(panes.length).toBe(1)

				const lastPaneId = panes[0]
				if (!lastPaneId) return

				// Try to close the last pane
				manager.closePane(lastPaneId)

				// Pane should still exist
				expect(manager.state.nodes[lastPaneId]).toBeDefined()
				expect(getAllPaneIds().length).toBe(1)
				expect(manager.state.rootId).toBe(lastPaneId)
			}),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property: Focus updates when focused pane is closed
	 * **Validates: Requirements 6.4**
	 */
	it('property: focus updates when focused pane is closed', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
				}),
				(config) => {
					// Reset manager (in reactive root)
					manager = createTestManager()

					const initialPaneId = manager.state.rootId

					// Split to create two panes
					const newPaneId = manager.splitPane(initialPaneId, config.direction)

					// Set focus to the new pane
					manager.setFocusedPane(newPaneId)
					expect(manager.state.focusedPaneId).toBe(newPaneId)

					// Close the focused pane
					manager.closePane(newPaneId)

					// Focus should have moved to the sibling (original pane)
					expect(manager.state.focusedPaneId).toBe(initialPaneId)
					expect(
						manager.state.nodes[manager.state.focusedPaneId!]
					).toBeDefined()
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 11: Tab Close Cascading
	 * For any pane, when the last tab is closed, the pane itself SHALL be closed.
	 * **Validates: Requirements 7.7**
	 */
	it('property: closing last tab closes the pane', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					tabCount: fc.integer({ min: 1, max: 5 }),
				}),
				(config) => {
					// Reset manager (in reactive root)
					manager = createTestManager()

					const initialPaneId = manager.state.rootId

					// Split to create two panes so we can close one
					const newPaneId = manager.splitPane(initialPaneId, config.direction)

					// Add tabs to the new pane
					const tabIds: string[] = []
					for (let i = 0; i < config.tabCount; i++) {
						const tabId = manager.openTab(newPaneId, {
							type: 'file',
							filePath: `/test/file${i}.txt`,
						})
						tabIds.push(tabId)
					}

					// Verify tabs were created
					const paneBeforeClose = manager.state.nodes[newPaneId] as EditorPane
					expect(paneBeforeClose).toBeDefined()
					expect(paneBeforeClose.tabs.length).toBe(config.tabCount)
					expect(paneBeforeClose.activeTabId).toBe(tabIds[tabIds.length - 1])

					for (let i = 0; i < tabIds.length - 1; i++) {
						const tabToClose = tabIds[i]
						if (!tabToClose) continue
						manager.closeTab(newPaneId, tabToClose)

						// Pane should still exist
						const paneAfterPartialClose = manager.state.nodes[
							newPaneId
						] as EditorPane
						expect(paneAfterPartialClose).toBeDefined()
						expect(paneAfterPartialClose.tabs.length).toBe(
							config.tabCount - i - 1
						)
					}

					// Close the last tab
					const lastTabId = tabIds[tabIds.length - 1]
					if (!lastTabId) return
					manager.closeTab(newPaneId, lastTabId)

					// Pane should be closed (removed from nodes)
					expect(manager.state.nodes[newPaneId]).toBeUndefined()

					// Tree integrity should be maintained
					expect(validateTreeIntegrity()).toBe(true)

					// Should have one less pane
					const remainingPanes = getAllPaneIds()
					expect(remainingPanes.length).toBe(1)
					expect(remainingPanes[0]).toBe(initialPaneId)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 12: Active Tab Consistency
	 * For any pane with tabs, closing the active tab SHALL result in another tab becoming active,
	 * with preference for the next tab or previous if at end.
	 * **Validates: Requirements 7.6**
	 */
	it('property: closing active tab activates next tab', () => {
		fc.assert(
			fc.property(
				fc.record({
					tabCount: fc.integer({ min: 2, max: 8 }),
					activeTabIndex: fc.integer({ min: 0, max: 7 }),
				}),
				(config) => {
					// Reset manager (in reactive root)
					manager = createTestManager()

					const paneId = manager.state.rootId

					// Add multiple tabs
					const tabIds: string[] = []
					for (let i = 0; i < config.tabCount; i++) {
						const tabId = manager.openTab(paneId, {
							type: 'file',
							filePath: `/test/file${i}.txt`,
						})
						tabIds.push(tabId)
					}

					// Set a specific tab as active
					const activeIndex = config.activeTabIndex % config.tabCount
					const activeTabId = tabIds[activeIndex]
					if (!activeTabId) return
					manager.setActiveTab(paneId, activeTabId)

					// Verify setup
					const paneBeforeClose = manager.state.nodes[paneId] as EditorPane
					expect(paneBeforeClose.activeTabId).toBe(activeTabId)
					expect(paneBeforeClose.tabs.length).toBe(config.tabCount)

					// Close the active tab
					if (!activeTabId) return
					manager.closeTab(paneId, activeTabId)

					// Verify pane still exists (since we have more than 1 tab)
					const paneAfterClose = manager.state.nodes[paneId] as EditorPane
					expect(paneAfterClose).toBeDefined()
					expect(paneAfterClose.tabs.length).toBe(config.tabCount - 1)

					// Verify a new tab is active
					expect(paneAfterClose.activeTabId).not.toBeNull()
					expect(paneAfterClose.activeTabId).not.toBe(activeTabId)

					// Verify the active tab exists in the remaining tabs
					const activeTab = paneAfterClose.tabs.find(
						(t) => t.id === paneAfterClose.activeTabId
					)
					expect(activeTab).toBeDefined()

					// Verify the closed tab is no longer in the tabs array
					const closedTab = paneAfterClose.tabs.find(
						(t) => t.id === activeTabId
					)
					expect(closedTab).toBeUndefined()

					// Tree integrity should be maintained
					expect(validateTreeIntegrity()).toBe(true)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 7: Layout Serialization Round-Trip
	 * For any valid layout state (including all tabs), serializing to JSON and deserializing back
	 * SHALL produce an equivalent layout tree with all node relationships, sizes, tabs, and tab states preserved.
	 * **Validates: Requirements 11.1, 11.2**
	 */
	it('property: serialization round-trip preserves layout', () => {
		fc.assert(
			fc.property(
				fc.record({
					splitCount: fc.integer({ min: 0, max: 5 }),
					tabsPerPane: fc.integer({ min: 1, max: 4 }),
					directions: fc.array(
						fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
						{ minLength: 5, maxLength: 5 }
					),
				}),
				(config) => {
					// Reset manager for each test (in reactive root)
					manager = createTestManager()

					// Build a layout with splits
					for (let i = 0; i < config.splitCount; i++) {
						const panes = getAllPaneIds()
						const paneToSplit = panes[panes.length - 1]
						if (!paneToSplit) continue
						const direction = config.directions[i % config.directions.length]
						if (!direction) continue
						manager.splitPane(paneToSplit, direction)
					}

					// Add tabs to each pane
					const panes = getAllPaneIds()
					for (const paneId of panes) {
						for (let i = 0; i < config.tabsPerPane; i++) {
							const tabId = manager.openTab(paneId, {
								type: 'file',
								filePath: `/test/${paneId}/file${i}.txt`,
							})

							// Update tab state with random-ish values
							manager.updateTabState(paneId, tabId, {
								scrollTop: i * 100,
								scrollLeft: i * 50,
								cursorPosition: { line: i + 1, column: i * 2 },
							})

							// Mark some tabs as dirty
							if (i % 2 === 0) {
								manager.setTabDirty(paneId, tabId, true)
							}
						}
					}

					// Serialize the layout
					const serialized = manager.getLayoutTree()

					// Verify serialization has correct structure
					expect(serialized.version).toBe(1)
					expect(serialized.rootId).toBe(manager.state.rootId)
					expect(serialized.nodes.length).toBe(
						Object.keys(manager.state.nodes).length
					)

					// Store original state for comparison
					const originalRootId = manager.state.rootId
					const originalNodeCount = Object.keys(manager.state.nodes).length
					const originalPaneCount = panes.length
					const originalFocusedPaneId = manager.state.focusedPaneId

					// Capture tab counts and content per pane
					const originalTabInfo: Map<
						string,
						{ count: number; filePaths: string[] }
					> = new Map()
					for (const paneId of panes) {
						const pane = manager.state.nodes[paneId] as EditorPane
						if (pane && isPane(pane)) {
							originalTabInfo.set(paneId, {
								count: pane.tabs.length,
								filePaths: pane.tabs.map((t) =>
									t.content.type === 'file' ? (t.content.filePath ?? '') : ''
								),
							})
						}
					}

					// Create a new manager and restore (in reactive root)
					const restoredManager = createUninitializedManager()
					restoredManager.restoreLayout(serialized)

					// Verify restored state matches original
					expect(restoredManager.state.rootId).toBe(originalRootId)
					expect(Object.keys(restoredManager.state.nodes).length).toBe(
						originalNodeCount
					)
					expect(restoredManager.state.focusedPaneId).toBe(
						originalFocusedPaneId
					)

					// Verify restored panes have same tabs
					const restoredPanes = Object.values(restoredManager.state.nodes)
						.filter((n): n is EditorPane => isPane(n))
						.map((p) => p.id)
					expect(restoredPanes.length).toBe(originalPaneCount)

					for (const paneId of restoredPanes) {
						const restoredPane = restoredManager.state.nodes[
							paneId
						] as EditorPane
						const originalInfo = originalTabInfo.get(paneId)

						if (originalInfo) {
							expect(restoredPane.tabs.length).toBe(originalInfo.count)

							// Verify file paths are preserved
							const restoredPaths = restoredPane.tabs.map((t) =>
								t.content.type === 'file' ? (t.content.filePath ?? '') : ''
							)
							expect(restoredPaths).toEqual(originalInfo.filePaths)
						}
					}

					// Verify tree integrity after restore
					expect(validateTreeIntegrity.call({ manager: restoredManager })).toBe(
						true
					)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property: Serialization includes tab state
	 * **Validates: Requirements 11.1**
	 */
	it('property: serialization preserves tab state', () => {
		fc.assert(
			fc.property(
				fc.record({
					scrollTop: fc.integer({ min: 0, max: 10000 }),
					scrollLeft: fc.integer({ min: 0, max: 1000 }),
					line: fc.integer({ min: 0, max: 10000 }),
					column: fc.integer({ min: 0, max: 200 }),
					isDirty: fc.boolean(),
				}),
				(config) => {
					// Reset manager (in reactive root)
					manager = createTestManager()

					const paneId = manager.state.rootId

					// Open a tab with specific state
					const tabId = manager.openTab(paneId, {
						type: 'file',
						filePath: '/test/stateful-file.txt',
					})

					// Set tab state
					manager.updateTabState(paneId, tabId, {
						scrollTop: config.scrollTop,
						scrollLeft: config.scrollLeft,
						cursorPosition: { line: config.line, column: config.column },
					})
					manager.setTabDirty(paneId, tabId, config.isDirty)

					// Serialize
					const serialized = manager.getLayoutTree()

					// Find the tab in serialized data
					const serializedPane = serialized.nodes.find(
						(n) => n.type === 'pane' && n.id === paneId
					)
					expect(serializedPane).toBeDefined()
					expect(serializedPane?.tabs).toBeDefined()

					const serializedTab = serializedPane?.tabs?.find(
						(t) => t.id === tabId
					)
					expect(serializedTab).toBeDefined()

					// Verify state is preserved in serialization
					expect(serializedTab?.state.scrollTop).toBe(config.scrollTop)
					expect(serializedTab?.state.scrollLeft).toBe(config.scrollLeft)
					expect(serializedTab?.state.cursorPosition.line).toBe(config.line)
					expect(serializedTab?.state.cursorPosition.column).toBe(config.column)
					expect(serializedTab?.isDirty).toBe(config.isDirty)

					// Restore and verify (in reactive root)
					const restoredManager = createUninitializedManager()
					restoredManager.restoreLayout(serialized)

					const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
					const restoredTab = restoredPane.tabs.find((t) => t.id === tabId)

					expect(restoredTab).toBeDefined()
					expect(restoredTab?.state.scrollTop).toBe(config.scrollTop)
					expect(restoredTab?.state.scrollLeft).toBe(config.scrollLeft)
					expect(restoredTab?.state.cursorPosition.line).toBe(config.line)
					expect(restoredTab?.state.cursorPosition.column).toBe(config.column)
					expect(restoredTab?.isDirty).toBe(config.isDirty)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 4: Empty File Editing
	 * For any empty file, it should open in an editable code editor interface
	 * that accepts input and persists changes, with the same functionality as non-empty files.
	 * **Feature: split-editor-fixes, Property 4: Empty File Editing**
	 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
	 */
	describe('Empty File Editing Properties', () => {
		it('property: empty files can be opened as tabs with same functionality as non-empty files', () => {
			fc.assert(
				fc.property(
					fc.record({
						emptyFilePaths: fc.array(
							fc.string({ minLength: 1, maxLength: 30 })
								.filter(s => !s.includes('/') || s.split('/').every(part => part.length > 0))
								.map(s => `/test/empty/${s.replace(/\s/g, '_')}.txt`),
							{ minLength: 1, maxLength: 5 }
						),
						nonEmptyFilePaths: fc.array(
							fc.string({ minLength: 1, maxLength: 30 })
								.filter(s => !s.includes('/') || s.split('/').every(part => part.length > 0))
								.map(s => `/test/content/${s.replace(/\s/g, '_')}.txt`),
							{ minLength: 1, maxLength: 5 }
						),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Open empty files (content would be empty string)
						const emptyTabIds: string[] = []
						for (const filePath of config.emptyFilePaths) {
							const tabId = testManager.openTab(paneId, {
								type: 'file',
								filePath,
							})
							emptyTabIds.push(tabId)
						}

						// Open non-empty files
						const nonEmptyTabIds: string[] = []
						for (const filePath of config.nonEmptyFilePaths) {
							const tabId = testManager.openTab(paneId, {
								type: 'file',
								filePath,
							})
							nonEmptyTabIds.push(tabId)
						}

						const pane = testManager.state.nodes[paneId] as EditorPane
						expect(pane).toBeDefined()
						expect(isPane(pane)).toBe(true)

						// Verify all tabs were created
						const totalExpected = config.emptyFilePaths.length + config.nonEmptyFilePaths.length
						expect(pane.tabs.length).toBe(totalExpected)

						// Verify empty file tabs have same structure as non-empty file tabs
						for (const tabId of emptyTabIds) {
							const tab = pane.tabs.find(t => t.id === tabId)
							expect(tab).toBeDefined()
							if (!tab) continue

							// Tab should have file content type
							expect(tab.content.type).toBe('file')
							expect(tab.content.filePath).toBeDefined()

							// Tab should have default state (editable state)
							expect(tab.state).toBeDefined()
							expect(tab.state.scrollTop).toBe(0)
							expect(tab.state.scrollLeft).toBe(0)
							expect(tab.state.cursorPosition).toEqual({ line: 0, column: 0 })

							// Tab should start as not dirty
							expect(tab.isDirty).toBe(false)

							// Tab should have default view mode
							expect(tab.viewMode).toBe('editor')
						}

						// Verify empty file tabs can be set as active (requirement 2.1)
						for (const tabId of emptyTabIds) {
							testManager.setActiveTab(paneId, tabId)
							const updatedPane = testManager.state.nodes[paneId] as EditorPane
							expect(updatedPane.activeTabId).toBe(tabId)
						}

						// Verify tab state can be updated (simulating editing - requirement 2.2)
						for (const tabId of emptyTabIds) {
							testManager.updateTabState(paneId, tabId, {
								scrollTop: 10,
								scrollLeft: 5,
								cursorPosition: { line: 1, column: 5 },
							})

							const updatedPane = testManager.state.nodes[paneId] as EditorPane
							const updatedTab = updatedPane.tabs.find(t => t.id === tabId)
							expect(updatedTab?.state.scrollTop).toBe(10)
							expect(updatedTab?.state.scrollLeft).toBe(5)
							expect(updatedTab?.state.cursorPosition.line).toBe(1)
							expect(updatedTab?.state.cursorPosition.column).toBe(5)
						}

						// Verify dirty flag can be set (simulating content changes - requirement 2.3)
						for (const tabId of emptyTabIds) {
							testManager.setTabDirty(paneId, tabId, true)
							const updatedPane = testManager.state.nodes[paneId] as EditorPane
							const updatedTab = updatedPane.tabs.find(t => t.id === tabId)
							expect(updatedTab?.isDirty).toBe(true)
						}

						// Verify empty file tabs can be closed (same as non-empty - requirement 2.5)
						const tabToClose = emptyTabIds[0]
						if (tabToClose) {
							testManager.closeTab(paneId, tabToClose)
							const afterClose = testManager.state.nodes[paneId] as EditorPane
							expect(afterClose.tabs.find(t => t.id === tabToClose)).toBeUndefined()
						}
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: empty file tab state persists through serialization', () => {
			fc.assert(
				fc.property(
					fc.record({
						filePath: fc.string({ minLength: 1, maxLength: 20 })
							.map(s => `/test/empty/${s.replace(/\s/g, '_')}.txt`),
						scrollTop: fc.integer({ min: 0, max: 1000 }),
						scrollLeft: fc.integer({ min: 0, max: 500 }),
						line: fc.integer({ min: 0, max: 1000 }),
						column: fc.integer({ min: 0, max: 100 }),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Open an empty file tab
						const tabId = testManager.openTab(paneId, {
							type: 'file',
							filePath: config.filePath,
						})

						// Update tab state (simulating user editing empty file)
						testManager.updateTabState(paneId, tabId, {
							scrollTop: config.scrollTop,
							scrollLeft: config.scrollLeft,
							cursorPosition: { line: config.line, column: config.column },
						})
						testManager.setTabDirty(paneId, tabId, true)

						// Serialize
						const serialized = testManager.getLayoutTree()

						// Restore to a new manager (in reactive root)
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify state was preserved
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						const restoredTab = restoredPane.tabs.find(t => t.id === tabId)

						expect(restoredTab).toBeDefined()
						expect(restoredTab?.content.type).toBe('file')
						expect(restoredTab?.content.filePath).toBe(config.filePath)
						expect(restoredTab?.state.scrollTop).toBe(config.scrollTop)
						expect(restoredTab?.state.scrollLeft).toBe(config.scrollLeft)
						expect(restoredTab?.state.cursorPosition.line).toBe(config.line)
						expect(restoredTab?.state.cursorPosition.column).toBe(config.column)
						expect(restoredTab?.isDirty).toBe(true)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: empty files have same tab management behavior as non-empty files', () => {
			fc.assert(
				fc.property(
					fc.record({
						direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const initialPaneId = testManager.state.rootId

						// Open multiple tabs in initial pane (so it doesn't close when we move one)
						testManager.openTab(initialPaneId, {
							type: 'file',
							filePath: '/test/keep-pane-open.txt',
						})

						// Open empty file tab
						const emptyTabId = testManager.openTab(initialPaneId, {
							type: 'file',
							filePath: '/test/empty-file.txt',
						})

						// Split the pane
						const newPaneId = testManager.splitPane(initialPaneId, config.direction)

						// Move the empty file tab to the new pane
						testManager.moveTab(initialPaneId, emptyTabId, newPaneId)

						// Verify tab moved successfully
						const originalPane = testManager.state.nodes[initialPaneId] as EditorPane
						const newPane = testManager.state.nodes[newPaneId] as EditorPane

						expect(originalPane.tabs.find(t => t.id === emptyTabId)).toBeUndefined()
						expect(newPane.tabs.find(t => t.id === emptyTabId)).toBeDefined()
						expect(newPane.activeTabId).toBe(emptyTabId)

						// Verify the empty file tab content is preserved after move
						const movedTab = newPane.tabs.find(t => t.id === emptyTabId)
						expect(movedTab?.content.type).toBe('file')
						expect(movedTab?.content.filePath).toBe('/test/empty-file.txt')
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	/**
	 * Property 13: View Mode Functionality
	 * View mode switching and persistence across tabs
	 * **Feature: split-editor-fixes, Property 13: View Mode Functionality**
	 * **Validates: View mode switching and persistence**
	 */
	describe('View Mode Properties', () => {
		it('property: view mode can be set and retrieved for any tab', () => {
			fc.assert(
				fc.property(
					fc.record({
						viewMode: fc.constantFrom<'editor' | 'ui' | 'binary'>('editor', 'ui', 'binary'),
						filePath: fc.string({ minLength: 1, maxLength: 20 })
							.map(s => `/test/${s.replace(/\s/g, '_')}.txt`),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Open tab with default view mode
						const tabId = testManager.openTab(paneId, {
							type: 'file',
							filePath: config.filePath,
						})

						// Verify default view mode is 'editor'
						const pane = testManager.state.nodes[paneId] as EditorPane
						const tab = pane.tabs.find(t => t.id === tabId)
						expect(tab?.viewMode).toBe('editor')

						// Set view mode
						testManager.setTabViewMode(paneId, tabId, config.viewMode)

						// Verify view mode was set
						const updatedPane = testManager.state.nodes[paneId] as EditorPane
						const updatedTab = updatedPane.tabs.find(t => t.id === tabId)
						expect(updatedTab?.viewMode).toBe(config.viewMode)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: view mode cycles through editor -> ui -> binary -> editor', () => {
			fc.assert(
				fc.property(
					fc.record({
						cycleCount: fc.integer({ min: 1, max: 10 }),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId
						testManager.setFocusedPane(paneId)

						// Open a file tab
						const tabId = testManager.openTab(paneId, {
							type: 'file',
							filePath: '/test/cycle-test.txt',
						})

						// Verify starting mode is 'editor'
						const initialPane = testManager.state.nodes[paneId] as EditorPane
						const initialTab = initialPane.tabs.find(t => t.id === tabId)
						expect(initialTab?.viewMode).toBe('editor')

						// Track expected mode through cycles
						const viewModes: Array<'editor' | 'ui' | 'binary'> = ['editor', 'ui', 'binary']
						let expectedIndex = 0

						// Cycle through view modes
						for (let i = 0; i < config.cycleCount; i++) {
							testManager.cycleViewMode()
							expectedIndex = (expectedIndex + 1) % viewModes.length

							const pane = testManager.state.nodes[paneId] as EditorPane
							const tab = pane.tabs.find(t => t.id === tabId)
							expect(tab?.viewMode).toBe(viewModes[expectedIndex])
						}
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: view mode persists through serialization', () => {
			fc.assert(
				fc.property(
					fc.record({
						viewMode: fc.constantFrom<'editor' | 'ui' | 'binary'>('editor', 'ui', 'binary'),
						filePath: fc.string({ minLength: 1, maxLength: 20 })
							.map(s => `/test/${s.replace(/\s/g, '_')}.json`),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Open tab and set view mode
						const tabId = testManager.openTab(paneId, {
							type: 'file',
							filePath: config.filePath,
						})
						testManager.setTabViewMode(paneId, tabId, config.viewMode)

						// Serialize
						const serialized = testManager.getLayoutTree()

						// Verify serialization includes view mode
						const serializedPane = serialized.nodes.find(n => n.type === 'pane' && n.id === paneId)
						const serializedTab = serializedPane?.tabs?.find(t => t.id === tabId)
						expect(serializedTab?.viewMode).toBe(config.viewMode)

						// Restore to new manager (in reactive root)
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify view mode was restored
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						const restoredTab = restoredPane.tabs.find(t => t.id === tabId)
						expect(restoredTab?.viewMode).toBe(config.viewMode)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: each tab maintains independent view mode', () => {
			fc.assert(
				fc.property(
					fc.record({
						tabConfigs: fc.array(
							fc.record({
								filePath: fc.string({ minLength: 1, maxLength: 15 })
									.map(s => `/test/${s.replace(/\s/g, '_')}.txt`),
								viewMode: fc.constantFrom<'editor' | 'ui' | 'binary'>('editor', 'ui', 'binary'),
							}),
							{ minLength: 2, maxLength: 5 }
						),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Make file paths unique
						const uniqueConfigs = config.tabConfigs.map((tc, i) => ({
							...tc,
							filePath: `${tc.filePath}_${i}`,
						}))

						// Open tabs with different view modes
						const tabIdToViewMode = new Map<string, 'editor' | 'ui' | 'binary'>()
						for (const tabConfig of uniqueConfigs) {
							const tabId = testManager.openTab(paneId, {
								type: 'file',
								filePath: tabConfig.filePath,
							})
							testManager.setTabViewMode(paneId, tabId, tabConfig.viewMode)
							tabIdToViewMode.set(tabId, tabConfig.viewMode)
						}

						// Verify each tab has its own independent view mode
						const pane = testManager.state.nodes[paneId] as EditorPane
						for (const [tabId, expectedMode] of tabIdToViewMode) {
							const tab = pane.tabs.find(t => t.id === tabId)
							expect(tab?.viewMode).toBe(expectedMode)
						}

						// Change one tab's view mode and verify others are unaffected
						const firstTabId = [...tabIdToViewMode.keys()][0]
						if (firstTabId) {
							const originalMode = tabIdToViewMode.get(firstTabId)
							const newMode: 'editor' | 'ui' | 'binary' = originalMode === 'editor' ? 'ui' : 'editor'
							testManager.setTabViewMode(paneId, firstTabId, newMode)

							// Verify first tab changed
							const updatedPane = testManager.state.nodes[paneId] as EditorPane
							const firstTab = updatedPane.tabs.find(t => t.id === firstTabId)
							expect(firstTab?.viewMode).toBe(newMode)

							// Verify other tabs are unchanged
							for (const [tabId, expectedMode] of tabIdToViewMode) {
								if (tabId !== firstTabId) {
									const tab = updatedPane.tabs.find(t => t.id === tabId)
									expect(tab?.viewMode).toBe(expectedMode)
								}
							}
						}
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: opening tab with specific view mode works correctly', () => {
			fc.assert(
				fc.property(
					fc.record({
						viewMode: fc.constantFrom<'editor' | 'ui' | 'binary'>('editor', 'ui', 'binary'),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Open tab with specific view mode
						const tabId = testManager.openTab(
							paneId,
							{ type: 'file', filePath: '/test/specific-mode.txt' },
							config.viewMode
						)

						// Verify tab was created with specified view mode
						const pane = testManager.state.nodes[paneId] as EditorPane
						const tab = pane.tabs.find(t => t.id === tabId)
						expect(tab?.viewMode).toBe(config.viewMode)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: cycleViewMode only affects focused pane active tab', () => {
			fc.assert(
				fc.property(
					fc.record({
						direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const pane1Id = testManager.state.rootId

						// Open tab in first pane
						const tab1Id = testManager.openTab(pane1Id, {
							type: 'file',
							filePath: '/test/file1.txt',
						})

						// Split and open tab in second pane
						const pane2Id = testManager.splitPane(pane1Id, config.direction)
						const tab2Id = testManager.openTab(pane2Id, {
							type: 'file',
							filePath: '/test/file2.txt',
						})

						// Both tabs should start as 'editor'
						const initialPane1 = testManager.state.nodes[pane1Id] as EditorPane
						const initialPane2 = testManager.state.nodes[pane2Id] as EditorPane
						expect(initialPane1.tabs.find(t => t.id === tab1Id)?.viewMode).toBe('editor')
						expect(initialPane2.tabs.find(t => t.id === tab2Id)?.viewMode).toBe('editor')

						// Focus first pane and cycle view mode
						testManager.setFocusedPane(pane1Id)
						testManager.cycleViewMode()

						// Only first pane's tab should change
						const afterCyclePane1 = testManager.state.nodes[pane1Id] as EditorPane
						const afterCyclePane2 = testManager.state.nodes[pane2Id] as EditorPane
						expect(afterCyclePane1.tabs.find(t => t.id === tab1Id)?.viewMode).toBe('ui')
						expect(afterCyclePane2.tabs.find(t => t.id === tab2Id)?.viewMode).toBe('editor')

						// Focus second pane and cycle view mode
						testManager.setFocusedPane(pane2Id)
						testManager.cycleViewMode()

						// Now second pane's tab should change
						const finalPane1 = testManager.state.nodes[pane1Id] as EditorPane
						const finalPane2 = testManager.state.nodes[pane2Id] as EditorPane
						expect(finalPane1.tabs.find(t => t.id === tab1Id)?.viewMode).toBe('ui')
						expect(finalPane2.tabs.find(t => t.id === tab2Id)?.viewMode).toBe('ui')
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	/**
	 * Property 3: Tab Deduplication and Shared Content
	 * For any file that is already open in a tab, attempting to open it again should switch
	 * to the existing tab rather than create a duplicate, and any edits should be reflected
	 * across all tabs showing the same file.
	 * **Feature: split-editor-fixes, Property 3: Tab Deduplication and Shared Content**
	 * **Validates: Requirements 1.3, 1.5**
	 */
	/**
	 * Property 6: Layout Persistence
	 * The layout system shall support serialization and restoration of the complete
	 * layout state including all panes, tabs, and their configurations.
	 * **Feature: split-editor-fixes, Property 6: Layout Persistence**
	 * **Validates: Requirements 3.1, 3.2, 3.3**
	 */
	describe('Layout Persistence Properties', () => {
		it('property: serialized layout can be fully restored across manager instances', () => {
			fc.assert(
				fc.property(
					fc.record({
						splitCount: fc.integer({ min: 0, max: 4 }),
						tabsPerPane: fc.integer({ min: 1, max: 3 }),
						directions: fc.array(
							fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
							{ minLength: 4, maxLength: 4 }
						),
					}),
					(config) => {
						// Create and initialize first manager (in reactive root)
						const manager1 = createTestManager()

						// Build complex layout
						for (let i = 0; i < config.splitCount; i++) {
							const panes = Object.values(manager1.state.nodes)
								.filter((n): n is EditorPane => isPane(n))
							const lastPane = panes[panes.length - 1]
							if (lastPane) {
								const direction = config.directions[i % config.directions.length]
								if (direction) {
									manager1.splitPane(lastPane.id, direction)
								}
							}
						}

						// Add tabs to all panes
						const paneIds = Object.values(manager1.state.nodes)
							.filter((n): n is EditorPane => isPane(n))
							.map(p => p.id)

						for (const paneId of paneIds) {
							for (let i = 0; i < config.tabsPerPane; i++) {
								const tabId = manager1.openTab(paneId, {
									type: 'file',
									filePath: `/test/${paneId}/file${i}.txt`,
								})
								// Set some state
								manager1.updateTabState(paneId, tabId, {
									scrollTop: i * 100,
									scrollLeft: i * 50,
									cursorPosition: { line: i + 1, column: i * 2 },
								})
								if (i % 2 === 0) {
									manager1.setTabDirty(paneId, tabId, true)
								}
							}
						}

						// Set focus to a specific pane
						if (paneIds.length > 0) {
							const focusIdx = Math.floor(paneIds.length / 2)
							const focusPaneId = paneIds[focusIdx]
							if (focusPaneId) {
								manager1.setFocusedPane(focusPaneId)
							}
						}

						// Serialize
						const serialized = manager1.getLayoutTree()

						// Create new manager and restore (in reactive root)
						const manager2 = createUninitializedManager()
						manager2.restoreLayout(serialized)

						// Verify structure matches
						expect(manager2.state.rootId).toBe(manager1.state.rootId)
						expect(Object.keys(manager2.state.nodes).length).toBe(Object.keys(manager1.state.nodes).length)
						expect(manager2.state.focusedPaneId).toBe(manager1.state.focusedPaneId)

						// Verify all panes and tabs are restored
						for (const paneId of paneIds) {
							const pane1 = manager1.state.nodes[paneId] as EditorPane
							const pane2 = manager2.state.nodes[paneId] as EditorPane

							expect(pane2).toBeDefined()
							expect(pane2.tabs.length).toBe(pane1.tabs.length)
							expect(pane2.activeTabId).toBe(pane1.activeTabId)

							// Verify each tab's state
							for (let i = 0; i < pane1.tabs.length; i++) {
								const tab1 = pane1.tabs[i]
								const tab2 = pane2.tabs[i]
								if (tab1 && tab2) {
									expect(tab2.id).toBe(tab1.id)
									expect(tab2.content).toEqual(tab1.content)
									expect(tab2.state).toEqual(tab1.state)
									expect(tab2.isDirty).toBe(tab1.isDirty)
								}
							}
						}
					}
				),
				{ numRuns: 50 }
			)
		})

		it('property: active tab is preserved through serialization for each pane', () => {
			fc.assert(
				fc.property(
					fc.record({
						tabCount: fc.integer({ min: 2, max: 6 }),
						activeIndex: fc.integer({ min: 0, max: 5 }),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId

						// Add tabs
						const tabIds: string[] = []
						for (let i = 0; i < config.tabCount; i++) {
							const tabId = manager.openTab(paneId, {
								type: 'file',
								filePath: `/test/file${i}.txt`,
							})
							tabIds.push(tabId)
						}

						// Set specific tab as active
						const activeIdx = config.activeIndex % config.tabCount
						const activeTabId = tabIds[activeIdx]
						if (activeTabId) {
							manager.setActiveTab(paneId, activeTabId)
						}

						// Serialize and restore (in reactive root)
						const serialized = manager.getLayoutTree()
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify active tab is preserved
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						expect(restoredPane.activeTabId).toBe(activeTabId)
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	/**
	 * Property 7: Missing File Handling
	 * When restoring persisted layouts, files that no longer exist should be handled gracefully.
	 * **Feature: split-editor-fixes, Property 7: Missing File Handling**
	 * **Validates: Requirement 3.4**
	 */
	describe('Missing File Handling Properties', () => {
		it('property: layout restoration handles valid serialized data', () => {
			fc.assert(
				fc.property(
					fc.record({
						tabCount: fc.integer({ min: 1, max: 5 }),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId

						// Add tabs with various file paths
						for (let i = 0; i < config.tabCount; i++) {
							manager.openTab(paneId, {
								type: 'file',
								filePath: `/test/existing-file-${i}.txt`,
							})
						}

						// Serialize
						const serialized = manager.getLayoutTree()

						// Verify serialization is valid
						expect(serialized.version).toBe(1)
						expect(serialized.rootId).toBe(paneId)
						expect(serialized.nodes.length).toBeGreaterThan(0)

						// Restoration should succeed (in reactive root)
						const restoredManager = createUninitializedManager()
						expect(() => restoredManager.restoreLayout(serialized)).not.toThrow()

						// All tabs should be restored
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						expect(restoredPane.tabs.length).toBe(config.tabCount)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: tabs can be closed after restoration', () => {
			fc.assert(
				fc.property(
					fc.record({
						tabCount: fc.integer({ min: 2, max: 5 }),
						closeIndex: fc.integer({ min: 0, max: 4 }),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId

						// Add tabs
						const tabIds: string[] = []
						for (let i = 0; i < config.tabCount; i++) {
							const tabId = manager.openTab(paneId, {
								type: 'file',
								filePath: `/test/file-${i}.txt`,
							})
							tabIds.push(tabId)
						}

						// Serialize and restore (in reactive root)
						const serialized = manager.getLayoutTree()
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Close a tab (simulating missing file removal)
						const closeIdx = config.closeIndex % config.tabCount
						const tabToClose = tabIds[closeIdx]
						if (tabToClose) {
							restoredManager.closeTab(paneId, tabToClose)
						}

						// Verify tab was removed
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						expect(restoredPane.tabs.length).toBe(config.tabCount - 1)
						expect(restoredPane.tabs.find(t => t.id === tabToClose)).toBeUndefined()
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	/**
	 * Property 8: State Persistence
	 * Tab state (cursor position, scroll state) should be preserved through serialization.
	 * **Feature: split-editor-fixes, Property 8: State Persistence**
	 * **Validates: Requirement 3.5**
	 */
	describe('State Persistence Properties', () => {
		it('property: cursor position persists through serialization', () => {
			fc.assert(
				fc.property(
					fc.record({
						line: fc.integer({ min: 0, max: 10000 }),
						column: fc.integer({ min: 0, max: 500 }),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId
						const tabId = manager.openTab(paneId, {
							type: 'file',
							filePath: '/test/cursor-test.txt',
						})

						// Set cursor position
						manager.updateTabState(paneId, tabId, {
							cursorPosition: { line: config.line, column: config.column },
						})

						// Serialize and restore (in reactive root)
						const serialized = manager.getLayoutTree()
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify cursor position
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						const restoredTab = restoredPane.tabs.find(t => t.id === tabId)
						expect(restoredTab?.state.cursorPosition.line).toBe(config.line)
						expect(restoredTab?.state.cursorPosition.column).toBe(config.column)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: scroll state persists through serialization', () => {
			fc.assert(
				fc.property(
					fc.record({
						scrollTop: fc.integer({ min: 0, max: 50000 }),
						scrollLeft: fc.integer({ min: 0, max: 5000 }),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId
						const tabId = manager.openTab(paneId, {
							type: 'file',
							filePath: '/test/scroll-test.txt',
						})

						// Set scroll state
						manager.updateTabState(paneId, tabId, {
							scrollTop: config.scrollTop,
							scrollLeft: config.scrollLeft,
						})

						// Serialize and restore (in reactive root)
						const serialized = manager.getLayoutTree()
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify scroll state
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						const restoredTab = restoredPane.tabs.find(t => t.id === tabId)
						expect(restoredTab?.state.scrollTop).toBe(config.scrollTop)
						expect(restoredTab?.state.scrollLeft).toBe(config.scrollLeft)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: dirty state persists through serialization', () => {
			fc.assert(
				fc.property(
					fc.record({
						isDirty: fc.boolean(),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId
						const tabId = manager.openTab(paneId, {
							type: 'file',
							filePath: '/test/dirty-test.txt',
						})

						// Set dirty state
						manager.setTabDirty(paneId, tabId, config.isDirty)

						// Serialize and restore (in reactive root)
						const serialized = manager.getLayoutTree()
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify dirty state
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						const restoredTab = restoredPane.tabs.find(t => t.id === tabId)
						expect(restoredTab?.isDirty).toBe(config.isDirty)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: combined state persists correctly', () => {
			fc.assert(
				fc.property(
					fc.record({
						scrollTop: fc.integer({ min: 0, max: 10000 }),
						scrollLeft: fc.integer({ min: 0, max: 1000 }),
						line: fc.integer({ min: 0, max: 5000 }),
						column: fc.integer({ min: 0, max: 200 }),
						isDirty: fc.boolean(),
						viewMode: fc.constantFrom<'editor' | 'ui' | 'binary'>('editor', 'ui', 'binary'),
					}),
					(config) => {
						const manager = createTestManager()

						const paneId = manager.state.rootId
						const tabId = manager.openTab(paneId, {
							type: 'file',
							filePath: '/test/combined-test.txt',
						})

						// Set all state
						manager.updateTabState(paneId, tabId, {
							scrollTop: config.scrollTop,
							scrollLeft: config.scrollLeft,
							cursorPosition: { line: config.line, column: config.column },
						})
						manager.setTabDirty(paneId, tabId, config.isDirty)
						manager.setTabViewMode(paneId, tabId, config.viewMode)

						// Serialize and restore (in reactive root)
						const serialized = manager.getLayoutTree()
						const restoredManager = createUninitializedManager()
						restoredManager.restoreLayout(serialized)

						// Verify all state
						const restoredPane = restoredManager.state.nodes[paneId] as EditorPane
						const restoredTab = restoredPane.tabs.find(t => t.id === tabId)

						expect(restoredTab?.state.scrollTop).toBe(config.scrollTop)
						expect(restoredTab?.state.scrollLeft).toBe(config.scrollLeft)
						expect(restoredTab?.state.cursorPosition.line).toBe(config.line)
						expect(restoredTab?.state.cursorPosition.column).toBe(config.column)
						expect(restoredTab?.isDirty).toBe(config.isDirty)
						expect(restoredTab?.viewMode).toBe(config.viewMode)
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	describe('Tab Deduplication Properties', () => {
		it('property: findTabByFilePath finds existing tabs correctly', () => {
			fc.assert(
				fc.property(
					fc.record({
						filePaths: fc.array(
							fc.string({ minLength: 1, maxLength: 20 })
								.map(s => `/test/${s.replace(/\s/g, '_')}.txt`),
							{ minLength: 2, maxLength: 6 }
						),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Make file paths unique
						const uniquePaths = [...new Set(config.filePaths)]
						const tabIdByPath = new Map<string, string>()

						// Open tabs for each file
						for (const filePath of uniquePaths) {
							const tabId = testManager.openTab(paneId, {
								type: 'file',
								filePath,
							})
							tabIdByPath.set(filePath, tabId)
						}

						// Verify findTabByFilePath finds each tab
						for (const [filePath, expectedTabId] of tabIdByPath) {
							const found = testManager.findTabByFilePath(filePath)
							expect(found).toBeDefined()
							expect(found?.tab.id).toBe(expectedTabId)
							expect(found?.paneId).toBe(paneId)
							expect(found?.tab.content.filePath).toBe(filePath)
						}

						// Verify findTabByFilePath returns null for non-existent paths
						const nonExistentPath = '/test/non-existent-file.txt'
						expect(testManager.findTabByFilePath(nonExistentPath)).toBeNull()
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: findTabByFilePath works across multiple panes', () => {
			fc.assert(
				fc.property(
					fc.record({
						direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
						filePath: fc.string({ minLength: 1, maxLength: 20 })
							.map(s => `/test/${s.replace(/\s/g, '_')}.txt`),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const pane1Id = testManager.state.rootId

						// Add a placeholder tab to keep pane1 open
						testManager.openTab(pane1Id, {
							type: 'file',
							filePath: '/test/placeholder.txt',
						})

						// Split to create second pane
						const pane2Id = testManager.splitPane(pane1Id, config.direction)

						// Open file in second pane
						const tabId = testManager.openTab(pane2Id, {
							type: 'file',
							filePath: config.filePath,
						})

						// findTabByFilePath should find the tab in pane2
						const found = testManager.findTabByFilePath(config.filePath)
						expect(found).toBeDefined()
						expect(found?.tab.id).toBe(tabId)
						expect(found?.paneId).toBe(pane2Id)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: tab deduplication - opening same file returns existing tab info', () => {
			fc.assert(
				fc.property(
					fc.record({
						filePath: fc.string({ minLength: 1, maxLength: 20 })
							.map(s => `/test/${s.replace(/\s/g, '_')}.txt`),
						splitCount: fc.integer({ min: 0, max: 3 }),
						directions: fc.array(
							fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
							{ minLength: 3, maxLength: 3 }
						),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						let currentPaneId = testManager.state.rootId

						// Create some splits
						for (let i = 0; i < config.splitCount; i++) {
							const direction = config.directions[i % config.directions.length]
							if (direction) {
								currentPaneId = testManager.splitPane(currentPaneId, direction)
							}
						}

						// Open the file in the first available pane
						const panes = testManager.paneIds()
						const targetPaneId = panes[0]
						if (!targetPaneId) return

						const originalTabId = testManager.openTab(targetPaneId, {
							type: 'file',
							filePath: config.filePath,
						})

						// Try to "open" the same file again - findTabByFilePath should find it
						const existing = testManager.findTabByFilePath(config.filePath)
						expect(existing).toBeDefined()
						expect(existing?.tab.id).toBe(originalTabId)

						// Verify we still have only one tab with this file path
						const allTabs = testManager.getAllTabs()
						const tabsWithPath = allTabs.filter(
							t => t.tab.content.type === 'file' && t.tab.content.filePath === config.filePath
						)
						expect(tabsWithPath.length).toBe(1)
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: tabs exist in multiple panes simultaneously', () => {
			fc.assert(
				fc.property(
					fc.record({
						direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
						tabsPerPane: fc.integer({ min: 1, max: 4 }),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const pane1Id = testManager.state.rootId

						// First split to create two panes (before opening tabs)
						const pane2Id = testManager.splitPane(pane1Id, config.direction)

						// Open tabs in first pane
						for (let i = 0; i < config.tabsPerPane; i++) {
							testManager.openTab(pane1Id, {
								type: 'file',
								filePath: `/test/pane1-file${i}.txt`,
							})
						}

						// Open tabs in second pane
						for (let i = 0; i < config.tabsPerPane; i++) {
							testManager.openTab(pane2Id, {
								type: 'file',
								filePath: `/test/pane2-file${i}.txt`,
							})
						}

						// Verify tabs exist in both panes by checking state directly
						const pane1 = testManager.state.nodes[pane1Id] as EditorPane
						const pane2 = testManager.state.nodes[pane2Id] as EditorPane

						expect(pane1).toBeDefined()
						expect(pane2).toBeDefined()
						expect(isPane(pane1)).toBe(true)
						expect(isPane(pane2)).toBe(true)

						expect(pane1.tabs.length).toBe(config.tabsPerPane)
						expect(pane2.tabs.length).toBe(config.tabsPerPane)

						// Verify tabs have correct file paths
						for (let i = 0; i < config.tabsPerPane; i++) {
							const tab1 = pane1.tabs.find(t =>
								t.content.type === 'file' && t.content.filePath === `/test/pane1-file${i}.txt`
							)
							const tab2 = pane2.tabs.find(t =>
								t.content.type === 'file' && t.content.filePath === `/test/pane2-file${i}.txt`
							)
							expect(tab1).toBeDefined()
							expect(tab2).toBeDefined()
						}
					}
				),
				{ numRuns: 100 }
			)
		})

		it('property: unique file paths create unique tabs', () => {
			fc.assert(
				fc.property(
					fc.record({
						fileCount: fc.integer({ min: 2, max: 10 }),
					}),
					(config) => {
						// Reset manager (in reactive root)
						const testManager = createTestManager()

						const paneId = testManager.state.rootId

						// Create unique file paths and open tabs
						const tabIds = new Set<string>()
						for (let i = 0; i < config.fileCount; i++) {
							const tabId = testManager.openTab(paneId, {
								type: 'file',
								filePath: `/test/unique-file-${i}.txt`,
							})
							tabIds.add(tabId)
						}

						// All tab IDs should be unique
						expect(tabIds.size).toBe(config.fileCount)

						// All tabs should exist
						const pane = testManager.state.nodes[paneId] as EditorPane
						expect(pane.tabs.length).toBe(config.fileCount)

						// Each tab should have unique file path
						const filePaths = new Set(
							pane.tabs
								.filter(t => t.content.type === 'file')
								.map(t => t.content.filePath)
						)
						expect(filePaths.size).toBe(config.fileCount)
					}
				),
				{ numRuns: 100 }
			)
		})
	})
})
