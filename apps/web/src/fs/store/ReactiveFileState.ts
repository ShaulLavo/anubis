/**
 * ReactiveFileState
 *
 * Resource-based file state management that properly separates:
 * - Content (async loaded via createResource)
 * - View state (sync signals)
 *
 * This eliminates the requestId race condition pattern by using
 * createResource which handles async coordination automatically.
 *
 * ## Migration Guide
 *
 * ### Before (requestId pattern):
 * ```typescript
 * let selectRequestId = 0
 * const selectPath = async (path) => {
 *   const requestId = ++selectRequestId
 *   const data = await loadFile(path)
 *   if (requestId !== selectRequestId) return // Stale, bail out
 *   setContent(data)
 * }
 * ```
 *
 * ### After (Resource pattern):
 * ```typescript
 * // Get ReactiveFileState from cache (lazy-created)
 * const fileState = fileCache.getFileState(path)
 *
 * // Access content via Resource - handles race conditions automatically
 * const isLoading = () => fileState.contentData.loading
 * const content = () => fileState.contentData()?.content ?? ''
 * const pieceTable = () => fileState.contentData()?.pieceTable
 *
 * // Access view state via signals
 * const scrollPos = fileState.scrollPosition()
 * fileState.setScrollPosition({ scrollTop: 100, ... })
 *
 * // Trigger refetch when needed
 * fileState.refetchContent()
 * ```
 *
 * ### Usage in components:
 * ```tsx
 * const MyComponent = () => {
 *   const [, { fileCache }] = useFs()
 *   const fileState = () => fileCache.getFileState(props.path)
 *
 *   return (
 *     <Show when={!fileState().contentData.loading} fallback={<Spinner />}>
 *       <Editor content={fileState().contentData()?.content ?? ''} />
 *     </Show>
 *   )
 * }
 * ```
 */

import {
	createResource,
	createSignal,
	type Accessor,
	type Resource,
	type Setter,
} from 'solid-js'
import type { FilePath } from '@repo/fs'
import type { ParseResult, PieceTableSnapshot } from '@repo/utils'
import type { VisibleContentSnapshot } from '@repo/code-editor'
import type { ViewMode } from '../types/ViewMode'
import type { ScrollPosition, CursorPosition, SelectionRange, SyntaxData } from './types'

/**
 * Content data loaded from the cache/disk.
 * This is what createResource returns.
 */
export interface FileContentData {
	readonly content: string
	readonly pieceTable: PieceTableSnapshot | null
	readonly stats: ParseResult | null
	readonly previewBytes: Uint8Array | null
}

// Re-export SyntaxData for convenience (avoid duplicate type)
export type { SyntaxData }

/**
 * ReactiveFileState - reactive interface for a file.
 *
 * Content fields use Resource (async with loading state).
 * View fields use signals (sync, persisted to localStorage).
 *
 * Note: This is distinct from FileState in store/types.ts which
 * is the storage/persistence representation with timestamps.
 */
export interface ReactiveFileState {
	/** The file path (identity) */
	readonly path: FilePath

	// === Content (Resource-based, async) ===

	/** File content and metadata, loaded via createResource */
	readonly contentData: Resource<FileContentData | undefined>

	/** Syntax highlighting data from tree-sitter */
	readonly syntaxData: Resource<SyntaxData | undefined>

	// === View State (signals, sync) ===

	/** Scroll position within the file */
	readonly scrollPosition: Accessor<ScrollPosition | undefined>
	readonly setScrollPosition: Setter<ScrollPosition | undefined>

	/** Cursor position within the file */
	readonly cursorPosition: Accessor<CursorPosition | undefined>
	readonly setCursorPosition: Setter<CursorPosition | undefined>

	/** Selection ranges */
	readonly selections: Accessor<SelectionRange[] | undefined>
	readonly setSelections: Setter<SelectionRange[] | undefined>

	/** Visible content snapshot for instant tab switching */
	readonly visibleContent: Accessor<VisibleContentSnapshot | undefined>
	readonly setVisibleContent: Setter<VisibleContentSnapshot | undefined>

	/** Current view mode (text, hex, image, etc.) */
	readonly viewMode: Accessor<ViewMode>
	readonly setViewMode: Setter<ViewMode>

	/** Whether file has unsaved changes */
	readonly isDirty: Accessor<boolean>
	readonly setIsDirty: Setter<boolean>

	// === Actions ===

	/** Refetch content from disk/cache */
	refetchContent: () => void

	/** Refetch syntax highlighting */
	refetchSyntax: () => void

	/** Mutate the content (for optimistic updates) */
	mutateContent: (data: FileContentData) => void

	/** Mutate syntax data (for optimistic updates) */
	mutateSyntax: (data: SyntaxData) => void
}

/**
 * Options for creating a ReactiveFileState.
 */
export interface CreateReactiveFileStateOptions {
	/** Initial path for the file */
	path: FilePath

	/** Function to load file content (called by createResource) */
	loadContent: (path: FilePath) => Promise<FileContentData | undefined>

	/** Function to load syntax data (called by createResource) */
	loadSyntax: (path: FilePath) => Promise<SyntaxData | undefined>

	/** Initial view state (from localStorage cache) */
	initialViewState?: {
		scrollPosition?: ScrollPosition
		cursorPosition?: CursorPosition
		selections?: SelectionRange[]
		visibleContent?: VisibleContentSnapshot
		viewMode?: ViewMode
		isDirty?: boolean
	}
}

/**
 * Create a ReactiveFileState for a file.
 *
 * This replaces the scattered signal stores with a single
 * Resource-based entry per file.
 */
export function createReactiveFileState(
	options: CreateReactiveFileStateOptions
): ReactiveFileState {
	const { path, loadContent, loadSyntax, initialViewState } = options

	// Content resource - handles async loading with automatic race condition handling
	const [contentData, { refetch: refetchContent, mutate: mutateContent }] =
		createResource(
			() => path,
			loadContent,
			{
				// Start loading immediately
				initialValue: undefined,
			}
		)

	// Syntax resource - depends on content being loaded
	const [syntaxData, { refetch: refetchSyntax, mutate: mutateSyntax }] =
		createResource(
			() => (contentData.state === 'ready' ? path : undefined),
			(p) => (p ? loadSyntax(p) : Promise.resolve(undefined)),
			{
				initialValue: undefined,
			}
		)

	// View state signals - sync, persisted to localStorage
	const [scrollPosition, setScrollPosition] = createSignal<ScrollPosition | undefined>(
		initialViewState?.scrollPosition
	)
	const [cursorPosition, setCursorPosition] = createSignal<CursorPosition | undefined>(
		initialViewState?.cursorPosition
	)
	const [selections, setSelections] = createSignal<SelectionRange[] | undefined>(
		initialViewState?.selections
	)
	const [visibleContent, setVisibleContent] = createSignal<VisibleContentSnapshot | undefined>(
		initialViewState?.visibleContent
	)
	const [viewMode, setViewMode] = createSignal<ViewMode>(
		initialViewState?.viewMode ?? 'editor'
	)
	const [isDirty, setIsDirty] = createSignal<boolean>(
		initialViewState?.isDirty ?? false
	)

	return {
		path,

		// Content (Resource-based)
		contentData,
		syntaxData,

		// View state (signals)
		scrollPosition,
		setScrollPosition,
		cursorPosition,
		setCursorPosition,
		selections,
		setSelections,
		visibleContent,
		setVisibleContent,
		viewMode,
		setViewMode,
		isDirty,
		setIsDirty,

		// Actions
		refetchContent,
		refetchSyntax,
		mutateContent,
		mutateSyntax,
	}
}

/**
 * Derived accessors for common content patterns.
 */
export function getFileContent(state: ReactiveFileState): string {
	return state.contentData()?.content ?? ''
}

export function getFilePieceTable(state: ReactiveFileState): PieceTableSnapshot | null {
	return state.contentData()?.pieceTable ?? null
}

export function getFileStats(state: ReactiveFileState): ParseResult | null {
	return state.contentData()?.stats ?? null
}

export function getFileHighlights(state: ReactiveFileState): SyntaxData['highlights'] {
	return state.syntaxData()?.highlights ?? []
}

export function getFileFolds(state: ReactiveFileState): SyntaxData['folds'] {
	return state.syntaxData()?.folds ?? []
}

export function getFileBrackets(state: ReactiveFileState): SyntaxData['brackets'] {
	return state.syntaxData()?.brackets ?? []
}

export function getFileErrors(state: ReactiveFileState): SyntaxData['errors'] {
	return state.syntaxData()?.errors ?? []
}

export function isFileLoading(state: ReactiveFileState): boolean {
	return state.contentData.loading
}

export function isFileSyntaxLoading(state: ReactiveFileState): boolean {
	return state.syntaxData.loading
}

// Backwards compatibility aliases
/** @deprecated Use ReactiveFileState instead */
export type UnifiedFileState = ReactiveFileState
/** @deprecated Use createReactiveFileState instead */
export const createUnifiedFileState = createReactiveFileState
/** @deprecated Use CreateReactiveFileStateOptions instead */
export type CreateUnifiedFileStateOptions = CreateReactiveFileStateOptions
/** @deprecated Use SyntaxData instead */
export type FileSyntaxData = SyntaxData
