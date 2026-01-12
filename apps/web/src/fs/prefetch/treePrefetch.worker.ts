import {
	createFs,
	walkDirectory,
	type FsContext,
	type FsDirTreeNode,
} from '@repo/fs'
import { expose } from 'comlink'
import { normalizeDirNodeMetadata } from '../utils/treeNodes'
import type {
	PrefetchTarget,
	TreePrefetchWorkerApi,
	DirectoryLoadResult,
	IndexableFile,
} from './treePrefetchWorkerTypes'

const LOAD_TIMEOUT_MS = 30_000 // 30 second timeout for loading large directories

let ctx: FsContext | undefined
let initialized = false
let fallbackRootName = 'root'

const ensureContext = () => {
	if (!ctx || !initialized) {
		throw new Error('TreePrefetch worker is not initialized')
	}
	return ctx
}

const deriveDirName = (path: string) => {
	if (!path) return fallbackRootName
	const segments = path.split('/').filter(Boolean)
	return segments[segments.length - 1] ?? fallbackRootName
}

const withTimeout = <T>(
	promise: Promise<T>,
	ms: number,
	timeoutValue: T
): Promise<T> => {
	let timeoutId: ReturnType<typeof setTimeout>
	const timeoutPromise = new Promise<T>((resolve) => {
		timeoutId = setTimeout(() => resolve(timeoutValue), ms)
	})
	return Promise.race([promise, timeoutPromise]).finally(() =>
		clearTimeout(timeoutId)
	)
}

/**
 * Extract pending targets, file count, and indexable files from a directory node.
 * This preprocessing happens in the worker to avoid main thread work.
 */
const extractFromNode = (node: FsDirTreeNode): {
	pendingTargets: PrefetchTarget[]
	fileCount: number
	filesToIndex: IndexableFile[]
} => {
	const pendingTargets: PrefetchTarget[] = []
	const filesToIndex: IndexableFile[] = []
	let fileCount = 0

	for (const child of node.children) {
		if (child.kind === 'file') {
			fileCount++
			filesToIndex.push({ path: child.path, kind: 'file' })
		} else if (child.kind === 'dir') {
			filesToIndex.push({ path: child.path, kind: 'dir' })
			if (child.isLoaded === false) {
				pendingTargets.push({
					path: child.path,
					name: child.name,
					depth: child.depth,
					parentPath: child.parentPath,
				})
			}
		}
	}

	return { pendingTargets, fileCount, filesToIndex }
}

const loadDirectoryTarget = async (
	target: PrefetchTarget
): Promise<DirectoryLoadResult | undefined> => {
	const context = ensureContext()

	// Add timeout to prevent hanging on slow/unresponsive directories
	const result = await withTimeout(
		walkDirectory(
			context,
			{ path: target.path, name: target.name || deriveDirName(target.path) },
			{ includeDirs: true, includeFiles: true, withMeta: false }
		),
		LOAD_TIMEOUT_MS,
		undefined
	)

	if (!result) {
		return undefined
	}

	const treeNode = normalizeDirNodeMetadata(
		{
			kind: 'dir',
			name: result.name,
			path: result.path,
			parentPath: target.parentPath,
			depth: target.depth,
			children: [...result.dirs, ...result.files],
			isLoaded: true,
		},
		target.parentPath,
		target.depth
	)

	// Precompute pending targets, file count, and indexable files in the worker
	const { pendingTargets, fileCount, filesToIndex } = extractFromNode(treeNode)

	return { node: treeNode, pendingTargets, fileCount, filesToIndex }
}

/**
 * Extract all pending targets from a tree. Runs entirely in worker.
 */
const extractPendingTargetsFromTree = (tree: FsDirTreeNode): {
	targets: PrefetchTarget[]
	loadedPaths: string[]
	totalFileCount: number
} => {
	const targets: PrefetchTarget[] = []
	const loadedPaths: string[] = []
	let totalFileCount = 0
	const stack: FsDirTreeNode[] = [tree]

	while (stack.length) {
		const dir = stack.pop()!

		if (dir.isLoaded !== false) {
			loadedPaths.push(dir.path ?? '')

			for (const child of dir.children) {
				if (child.kind === 'file') {
					totalFileCount++
				} else if (child.kind === 'dir') {
					if (child.isLoaded === false) {
						targets.push({
							path: child.path,
							name: child.name,
							depth: child.depth,
							parentPath: child.parentPath,
						})
					} else {
						stack.push(child)
					}
				}
			}
		}
	}

	return { targets, loadedPaths, totalFileCount }
}

const api: TreePrefetchWorkerApi = {
	async init(payload) {
		ctx = createFs(payload.rootHandle)
		fallbackRootName = payload.rootName || 'root'
		initialized = true
	},
	async loadDirectory(target) {
		if (!initialized) return undefined
		return loadDirectoryTarget(target)
	},
	async extractPendingTargets(tree) {
		return extractPendingTargetsFromTree(tree)
	},
	async dispose() {
		ctx = undefined
		initialized = false
	},
}

expose(api)
