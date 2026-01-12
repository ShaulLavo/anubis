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
} from './treePrefetchWorkerTypes'

const LOAD_TIMEOUT_MS = 5_000 // 5 second timeout for loading a directory

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

const loadDirectoryTarget = async (
	target: PrefetchTarget
): Promise<FsDirTreeNode | undefined> => {
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

	return treeNode
}

const api: TreePrefetchWorkerApi = {
	async init(payload) {
		ctx = createFs(payload.rootHandle)
		fallbackRootName = payload.rootName || 'root'
		initialized = true
		console.debug('[PrefetchWorker] Initialized')
	},
	async loadDirectory(target) {
		if (!initialized) {
			console.warn('[PrefetchWorker] loadDirectory called but not initialized')
			return undefined
		}
		return loadDirectoryTarget(target)
	},
	async dispose() {
		ctx = undefined
		initialized = false
	},
}

expose(api)
