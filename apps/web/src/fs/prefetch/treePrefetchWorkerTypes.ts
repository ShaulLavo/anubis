import type { FsDirTreeNode } from '@repo/fs'
import type { FsSource } from '../types'

export type PrefetchTarget = {
	path: string
	name: string
	depth: number
	parentPath?: string
}

export type TreePrefetchWorkerInitPayload = {
	source: FsSource
	rootHandle: FileSystemDirectoryHandle
	rootPath: string
	rootName: string
}

export type PrefetchStatusMilestone = {
	processedCount: number
	pending: number
	deferred: number
	indexedFileCount: number
	lastDurationMs: number
	averageDurationMs: number
}

export type PrefetchStatusPayload = {
	running: boolean
	pending: number
	deferred: number
	indexedFileCount: number
	processedCount: number
	lastDurationMs: number
	averageDurationMs: number
	milestone?: PrefetchStatusMilestone
}

export type PrefetchDirectoryLoadedPayload = {
	node: FsDirTreeNode
}

export type DeferredDirMetadata = Omit<FsDirTreeNode, 'children'> & {
	children?: never
}

export type PrefetchDeferredMetadataPayload = {
	node: DeferredDirMetadata
}

export type PrefetchErrorPayload = {
	message: string
}

export type TreePrefetchWorkerCallbacks = {
	onDirectoryLoaded(payload: PrefetchDirectoryLoadedPayload): void
	onStatus(payload: PrefetchStatusPayload): void
	onDeferredMetadata?(payload: PrefetchDeferredMetadataPayload): void
	onError?(payload: PrefetchErrorPayload): void
}

/** File/dir metadata for search indexing */
export type IndexableFile = {
	path: string
	kind: 'file' | 'dir'
}

/** Result from loading a directory, with precomputed pending targets */
export type DirectoryLoadResult = {
	node: FsDirTreeNode
	/** Child directories that need loading (isLoaded === false) */
	pendingTargets: PrefetchTarget[]
	/** Count of files in this directory (for indexing stats) */
	fileCount: number
	/** Files and dirs to index for search */
	filesToIndex: IndexableFile[]
}

export type TreePrefetchWorkerApi = {
	init(payload: TreePrefetchWorkerInitPayload): Promise<void>
	/** Load a directory and precompute pending targets in the worker */
	loadDirectory(target: PrefetchTarget): Promise<DirectoryLoadResult | undefined>
	/** Seed tree and extract all pending targets in the worker */
	extractPendingTargets(tree: FsDirTreeNode): Promise<{
		targets: PrefetchTarget[]
		loadedPaths: string[]
		totalFileCount: number
	}>
	dispose(): Promise<void>
}
