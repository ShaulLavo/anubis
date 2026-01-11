/**
 * Layout Manager Store
 *
 * Reactive SolidJS store managing the split editor layout tree.
 * Uses createStore with produce for immutable updates and reconcile for efficient tree diffing.
 */

import { batch, createMemo } from 'solid-js'
import { createStore, produce, reconcile } from 'solid-js/store'
import type {
	EditorPane,
	LayoutState,
	NodeId,
	PaneContent,
	PaneState,
	ScrollSyncGroup,
	ScrollSyncMode,
	SerializedLayout,
	SerializedNode,
	SplitContainer,
	SplitDirection,
	SplitNode,
} from './types'
import {
	createDefaultPaneState,
	createEmptyContent,
	isContainer,
	isPane,
} from './types'

/** Generate unique node ID */
function generateId(): NodeId {
	return crypto.randomUUID()
}

/** Find first pane in a subtree (depth-first) */
function findFirstPane(
	nodes: Record<NodeId, SplitNode>,
	nodeId: NodeId
): NodeId | null {
	const node = nodes[nodeId]
	if (!node) return null
	if (isPane(node)) return node.id
	if (isContainer(node)) {
		return (
			findFirstPane(nodes, node.children[0]) ??
			findFirstPane(nodes, node.children[1])
		)
	}
	return null
}

/** Create the layout manager store */
export function createLayoutManager() {
	const [state, setState] = createStore<LayoutState>({
		rootId: '',
		nodes: {},
		focusedPaneId: null,
		scrollSyncGroups: [],
	})

	// Derived: get all pane IDs
	const paneIds = createMemo(() =>
		Object.values(state.nodes)
			.filter((n): n is EditorPane => isPane(n))
			.map((p) => p.id)
	)

	// Derived: get panes showing a specific file
	const getPanesForFile = (filePath: string) =>
		createMemo(() =>
			Object.values(state.nodes).filter(
				(n): n is EditorPane =>
					isPane(n) && n.content.filePath === filePath
			)
		)

	// ========================================================================
	// Initialization
	// ========================================================================

	/** Initialize with a single pane */
	function initialize(): void {
		const paneId = generateId()
		const pane: EditorPane = {
			id: paneId,
			type: 'pane',
			parentId: null,
			content: createEmptyContent(),
			state: createDefaultPaneState(),
		}

		batch(() => {
			setState('rootId', paneId)
			setState('nodes', { [paneId]: pane })
			setState('focusedPaneId', paneId)
		})
	}

	// ========================================================================
	// Split Operations
	// ========================================================================

	/** Split a pane into two */
	function splitPane(paneId: NodeId, direction: SplitDirection): NodeId {
		const newPaneId = generateId()
		const newContainerId = generateId()

		batch(() => {
			setState(
				produce((s) => {
					const pane = s.nodes[paneId] as EditorPane | undefined
					if (!pane || !isPane(pane)) return

					const parentId = pane.parentId

					// Create new pane (empty)
					const newPane: EditorPane = {
						id: newPaneId,
						type: 'pane',
						parentId: newContainerId,
						content: createEmptyContent(),
						state: createDefaultPaneState(),
					}

					// Create container to hold both panes
					const container: SplitContainer = {
						id: newContainerId,
						type: 'container',
						parentId: parentId,
						direction,
						sizes: [0.5, 0.5],
						children: [paneId, newPaneId],
					}

					// Update original pane's parent
					;(s.nodes[paneId] as EditorPane).parentId = newContainerId

					// Update parent's child reference
					if (parentId) {
						const parent = s.nodes[parentId] as
							| SplitContainer
							| undefined
						if (parent && isContainer(parent)) {
							const childIndex = parent.children.indexOf(paneId)
							if (childIndex !== -1) {
								parent.children[childIndex] = newContainerId
							}
						}
					} else {
						// Original pane was root
						s.rootId = newContainerId
					}

					// Add new nodes
					s.nodes[newContainerId] = container
					s.nodes[newPaneId] = newPane
				})
			)
		})

		return newPaneId
	}

	// ========================================================================
	// Close Operations
	// ========================================================================

	/** Close a pane */
	function closePane(paneId: NodeId): void {
		batch(() => {
			setState(
				produce((s) => {
					const pane = s.nodes[paneId]
					if (!pane) return

					const parentId = pane.parentId

					if (!parentId) {
						// Can't close the last pane
						return
					}

					const parent = s.nodes[parentId] as
						| SplitContainer
						| undefined
					if (!parent || !isContainer(parent)) return

					const siblingId = parent.children.find(
						(id) => id !== paneId
					)
					if (!siblingId) return

					const sibling = s.nodes[siblingId]
					if (!sibling) return

					const grandparentId = parent.parentId

					// Promote sibling to parent's position
					sibling.parentId = grandparentId

					if (grandparentId) {
						const grandparent = s.nodes[grandparentId] as
							| SplitContainer
							| undefined
						if (grandparent && isContainer(grandparent)) {
							const parentIndex =
								grandparent.children.indexOf(parentId)
							if (parentIndex !== -1) {
								grandparent.children[parentIndex] = siblingId
							}
						}
					} else {
						// Parent was root, sibling becomes new root
						s.rootId = siblingId
					}

					// Remove closed pane and collapsed container
					delete s.nodes[paneId]
					delete s.nodes[parentId]

					// Update focus if needed
					if (s.focusedPaneId === paneId) {
						s.focusedPaneId = findFirstPane(s.nodes, siblingId)
					}
				})
			)
		})
	}

	// ========================================================================
	// Pane Content & State
	// ========================================================================

	/** Set pane content */
	function setPaneContent(paneId: NodeId, content: PaneContent): void {
		setState(
			produce((s) => {
				const pane = s.nodes[paneId]
				if (pane && isPane(pane)) {
					pane.content = content
				}
			})
		)
	}

	/** Update pane state */
	function updatePaneState(
		paneId: NodeId,
		updates: Partial<PaneState>
	): void {
		batch(() => {
			setState(
				produce((s) => {
					const pane = s.nodes[paneId]
					if (!pane || !isPane(pane)) return
					Object.assign(pane.state, updates)
				})
			)
		})
	}

	/** Update split sizes */
	function updateSplitSizes(
		containerId: NodeId,
		sizes: [number, number]
	): void {
		setState(
			produce((s) => {
				const container = s.nodes[containerId]
				if (container && isContainer(container)) {
					container.sizes = sizes
				}
			})
		)
	}

	// ========================================================================
	// Focus Management
	// ========================================================================

	/** Set focused pane */
	function setFocusedPane(paneId: NodeId): void {
		setState('focusedPaneId', paneId)
	}

	/** Navigate focus in a direction */
	function navigateFocus(
		direction: 'up' | 'down' | 'left' | 'right'
	): void {
		// Implementation will be added in task 10
		// For now, just cycle through panes
		const panes = paneIds()
		if (panes.length === 0) return

		const currentIndex = panes.indexOf(state.focusedPaneId ?? '')
		const nextIndex = (currentIndex + 1) % panes.length
		const nextPaneId = panes[nextIndex]
		if (nextPaneId) {
			setState('focusedPaneId', nextPaneId)
		}
	}

	// ========================================================================
	// Scroll Sync
	// ========================================================================

	/** Link panes for scroll sync */
	function linkScrollSync(
		paneIdList: NodeId[],
		mode: ScrollSyncMode
	): string {
		const groupId = generateId()
		const group: ScrollSyncGroup = {
			id: groupId,
			paneIds: paneIdList,
			mode,
		}

		setState(
			produce((s) => {
				s.scrollSyncGroups.push(group)
			})
		)

		return groupId
	}

	/** Unlink scroll sync */
	function unlinkScrollSync(groupId: string): void {
		setState(
			produce((s) => {
				const index = s.scrollSyncGroups.findIndex(
					(g) => g.id === groupId
				)
				if (index !== -1) {
					s.scrollSyncGroups.splice(index, 1)
				}
			})
		)
	}

	// ========================================================================
	// Serialization
	// ========================================================================

	/** Get layout tree for serialization */
	function getLayoutTree(): SerializedLayout {
		const nodes: SerializedNode[] = Object.values(state.nodes).map(
			(node) => {
				if (isContainer(node)) {
					return {
						id: node.id,
						parentId: node.parentId,
						type: 'container' as const,
						direction: node.direction,
						sizes: node.sizes,
						children: node.children,
					}
				}
				return {
					id: node.id,
					parentId: node.parentId,
					type: 'pane' as const,
					content: node.content,
					state: node.state,
				}
			}
		)

		return {
			version: 1,
			rootId: state.rootId,
			nodes,
			focusedPaneId: state.focusedPaneId,
			scrollSyncGroups: [...state.scrollSyncGroups],
		}
	}

	/** Restore layout from serialized state */
	function restoreLayout(layout: SerializedLayout): void {
		const nodes: Record<NodeId, SplitNode> = {}

		for (const serialized of layout.nodes) {
			if (serialized.type === 'container') {
				nodes[serialized.id] = {
					id: serialized.id,
					parentId: serialized.parentId,
					type: 'container',
					direction: serialized.direction!,
					sizes: serialized.sizes!,
					children: serialized.children!,
				}
			} else {
				nodes[serialized.id] = {
					id: serialized.id,
					parentId: serialized.parentId,
					type: 'pane',
					content: serialized.content ?? createEmptyContent(),
					state: serialized.state ?? createDefaultPaneState(),
				}
			}
		}

		batch(() => {
			setState('rootId', layout.rootId)
			setState('nodes', reconcile(nodes))
			setState('focusedPaneId', layout.focusedPaneId ?? null)
			setState('scrollSyncGroups', reconcile(layout.scrollSyncGroups))
		})
	}

	return {
		state,
		paneIds,
		getPanesForFile,
		initialize,
		splitPane,
		closePane,
		setPaneContent,
		updatePaneState,
		updateSplitSizes,
		setFocusedPane,
		navigateFocus,
		linkScrollSync,
		unlinkScrollSync,
		getLayoutTree,
		restoreLayout,
	}
}

export type LayoutManager = ReturnType<typeof createLayoutManager>
