/**
 * Split Editor Layout Types
 *
 * Defines the binary tree structure for recursive split layouts.
 * Each node is either a SplitContainer (with two children) or an EditorPane (leaf).
 */

/** Unique identifier for nodes in the layout tree */
export type NodeId = string

/** Direction of a split */
export type SplitDirection = 'horizontal' | 'vertical'

/** Position in the editor */
export interface Position {
	line: number
	column: number
}

/** Text selection range */
export interface Selection {
	start: Position
	end: Position
}

/** View settings per pane */
export interface ViewSettings {
	showLineNumbers: boolean
	showMinimap: boolean
	wordWrap: boolean
	fontSize: number
}

/** Per-pane state (independent per pane) */
export interface PaneState {
	scrollTop: number
	scrollLeft: number
	selections: Selection[]
	cursorPosition: Position
	viewSettings: ViewSettings
}

/** Diff data for diff panes */
export interface DiffData {
	originalPath: string
	modifiedPath: string
	originalContent?: string
	modifiedContent?: string
}

/** Content displayed in a pane */
export interface PaneContent {
	type: 'file' | 'diff' | 'empty' | 'custom'
	filePath?: string
	diffData?: DiffData
	customComponent?: string
}

/** Base node in the layout tree */
interface BaseNode {
	id: NodeId
	parentId: NodeId | null
}

/** A split container with two children */
export interface SplitContainer extends BaseNode {
	type: 'container'
	direction: SplitDirection
	sizes: [number, number]
	children: [NodeId, NodeId]
}

/** An editor pane (leaf node) */
export interface EditorPane extends BaseNode {
	type: 'pane'
	content: PaneContent
	state: PaneState
}

/** Union type for all nodes */
export type SplitNode = SplitContainer | EditorPane

/** Scroll sync mode */
export type ScrollSyncMode = 'line' | 'percentage'

/** Scroll sync group */
export interface ScrollSyncGroup {
	id: string
	paneIds: NodeId[]
	mode: ScrollSyncMode
}

/** Complete layout state */
export interface LayoutState {
	rootId: NodeId
	nodes: Record<NodeId, SplitNode>
	focusedPaneId: NodeId | null
	scrollSyncGroups: ScrollSyncGroup[]
}

// ============================================================================
// Serialization Types (for persistence)
// ============================================================================

/** Serialized node for persistence */
export interface SerializedNode {
	id: NodeId
	parentId: NodeId | null
	type: 'container' | 'pane'
	// Container fields
	direction?: SplitDirection
	sizes?: [number, number]
	children?: [NodeId, NodeId]
	// Pane fields
	content?: PaneContent
	state?: PaneState
}

/** Serialized layout for persistence */
export interface SerializedLayout {
	version: 1
	rootId: NodeId
	nodes: SerializedNode[]
	focusedPaneId: NodeId | null
	scrollSyncGroups: ScrollSyncGroup[]
}

// ============================================================================
// Type Guards
// ============================================================================

export function isContainer(node: SplitNode): node is SplitContainer {
	return node.type === 'container'
}

export function isPane(node: SplitNode): node is EditorPane {
	return node.type === 'pane'
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultViewSettings(): ViewSettings {
	return {
		showLineNumbers: true,
		showMinimap: false,
		wordWrap: false,
		fontSize: 14,
	}
}

export function createDefaultPaneState(): PaneState {
	return {
		scrollTop: 0,
		scrollLeft: 0,
		selections: [],
		cursorPosition: { line: 0, column: 0 },
		viewSettings: createDefaultViewSettings(),
	}
}

export function createEmptyContent(): PaneContent {
	return { type: 'empty' }
}

export function createFileContent(filePath: string): PaneContent {
	return { type: 'file', filePath }
}

export function createDiffContent(diffData: DiffData): PaneContent {
	return { type: 'diff', diffData }
}
