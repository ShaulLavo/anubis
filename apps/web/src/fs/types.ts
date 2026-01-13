import type { FsDirTreeNode, FsFileTreeNode, FsTreeNode, FilePath } from '@repo/fs'
import type { ParseResult, PieceTableSnapshot } from '@repo/utils'
import type { VisibleContentSnapshot } from '@repo/code-editor'
import type {
	TreeSitterCapture,
	BracketInfo,
	TreeSitterError,
	FoldRange,
} from '../workers/treeSitter/types'
import type { DeferredDirMetadata } from './prefetch/treePrefetchWorkerTypes'
import type { ScrollPosition, HighlightTransform, CursorPosition, SelectionRange } from './store/types'
import type { ViewMode } from './types/ViewMode'

export type FsSource = 'memory' | 'local' | 'opfs'

export type FsState = {
	tree?: FsDirTreeNode
	pathIndex: Record<FilePath, FsTreeNode>
	expanded: Record<FilePath, boolean>
	selectedPath?: FilePath
	activeSource: FsSource
	selectedFileLoading: boolean
	selectedFileContent: string
	selectedFilePreviewBytes?: Uint8Array
	selectedFileSize?: number
	loading: boolean
	saving: boolean
	backgroundPrefetching: boolean
	backgroundIndexedFileCount: number
	lastPrefetchedPath?: FilePath
	prefetchError?: string
	prefetchProcessedCount: number
	prefetchLastDurationMs: number
	prefetchAverageDurationMs: number
	fileStats: Record<FilePath, ParseResult | undefined>
	selectedFileStats?: ParseResult
	pieceTables: Record<FilePath, PieceTableSnapshot | undefined>
	selectedFilePieceTable?: PieceTableSnapshot
	fileHighlights: Record<FilePath, TreeSitterCapture[] | undefined>
	/** Pending offset transforms for optimistic updates (ordered oldest -> newest) */
	highlightOffsets: Record<FilePath, HighlightTransform[] | undefined>
	selectedFileHighlights?: TreeSitterCapture[]
	selectedFileHighlightOffset?: HighlightTransform[]
	fileFolds: Record<FilePath, FoldRange[] | undefined>
	selectedFileFolds?: FoldRange[]
	fileBrackets: Record<FilePath, BracketInfo[] | undefined>
	selectedFileBrackets?: BracketInfo[]
	fileErrors: Record<FilePath, TreeSitterError[] | undefined>
	selectedFileErrors?: TreeSitterError[]
	selectedNode?: FsTreeNode | undefined
	lastKnownFileNode?: FsFileTreeNode | undefined
	lastKnownFilePath?: FilePath
	deferredMetadata: Record<FilePath, DeferredDirMetadata>
	dirtyPaths: Record<FilePath, boolean>
	scrollPositions: Record<FilePath, ScrollPosition | undefined>
	selectedFileScrollPosition?: ScrollPosition
	/** Cursor positions for each file */
	cursorPositions: Record<FilePath, CursorPosition | undefined>
	selectedFileCursorPosition?: CursorPosition
	/** Selection ranges for each file */
	fileSelections: Record<FilePath, SelectionRange[] | undefined>
	selectedFileSelections?: SelectionRange[]
	/** Pre-computed visible content for instant tab switching */
	visibleContents: Record<FilePath, VisibleContentSnapshot | undefined>
	selectedFileVisibleContent?: VisibleContentSnapshot
	/** Current view mode for each file */
	fileViewModes: Record<FilePath, ViewMode>
	selectedFileViewMode?: ViewMode
	creationState?: {
		type: 'file' | 'folder'
		parentPath: FilePath
	} | null
}
