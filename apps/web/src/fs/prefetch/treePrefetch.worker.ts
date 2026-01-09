import {
	createFs,
	walkDirectory,
	type FsContext,
	type FsDirTreeNode,
} from '@repo/fs'
import { expose } from 'comlink'
import { normalizeDirNodeMetadata } from '../utils/treeNodes'
import { createWorkerTreeCache, type WorkerTreeCache } from '../cache/workerTreeCache'
import type {
	PrefetchTarget,
	TreePrefetchWorkerApi,
} from './treePrefetchWorkerTypes'

let ctx: FsContext | undefined
let initialized = false
let fallbackRootName = 'root'
let workerCache: WorkerTreeCache | undefined

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

const loadDirectoryTarget = async (
	target: PrefetchTarget
): Promise<FsDirTreeNode | undefined> => {
	const context = ensureContext()
	console.log(`[treePrefetch.worker] loadDirectoryTarget called for path: ${target.path}`)
	
	// Check cache first if available
	if (workerCache) {
		try {
			console.log(`[treePrefetch.worker] Checking cache for: ${target.path}`)
			const cached = await workerCache.getDirectory(target.path)
			if (cached) {
				console.log(`[treePrefetch.worker] Cache HIT for: ${target.path}`, {
					childrenCount: cached.children?.length ?? 0,
					cachedAt: cached.cachedAt,
					isLoaded: cached.isLoaded,
				})
				
				// Convert cached entry back to tree node
				const children = cached.children.map(child => {
					if (child.kind === 'file') {
						return {
							kind: 'file' as const,
							name: child.name,
							path: child.path,
							depth: child.depth,
							parentPath: child.parentPath,
							size: child.size,
							lastModified: child.lastModified,
						}
					} else {
						return {
							kind: 'dir' as const,
							name: child.name,
							path: child.path,
							depth: child.depth,
							parentPath: child.parentPath,
							children: [],
							isLoaded: child.isLoaded ?? false,
						}
					}
				})
				
				const treeNode: FsDirTreeNode = {
					kind: 'dir',
					name: cached.name,
					path: cached.path,
					depth: cached.depth,
					parentPath: cached.parentPath,
					children,
					isLoaded: cached.isLoaded,
				}
				
				console.log(`[treePrefetch.worker] Returning cached tree node for: ${target.path}`)
				return treeNode
			} else {
				console.log(`[treePrefetch.worker] Cache MISS for: ${target.path}`)
			}
		} catch (error) {
			console.warn(`Worker cache check failed for ${target.path}:`, error)
		}
	} else {
		console.log(`[treePrefetch.worker] No workerCache available for: ${target.path}`)
	}
	
	// Perform filesystem scan
	console.log(`[treePrefetch.worker] Performing FS scan for: ${target.path}`)
	const result = await walkDirectory(
		context,
		{ path: target.path, name: target.name || deriveDirName(target.path) },
		{ includeDirs: true, includeFiles: true, withMeta: false }
	)

	if (!result) {
		console.log(`[treePrefetch.worker] walkDirectory returned undefined for: ${target.path}`)
		return undefined
	}
	console.log(`[treePrefetch.worker] FS scan complete for: ${target.path}`, {
		dirsCount: result.dirs?.length ?? 0,
		filesCount: result.files?.length ?? 0,
	})

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
	
	// Populate cache with scan results
	if (workerCache && treeNode) {
		try {
			const cachedEntry = {
				path: treeNode.path,
				name: treeNode.name,
				depth: treeNode.depth,
				parentPath: treeNode.parentPath,
				cachedAt: Date.now(),
				lastModified: Date.now(), // TODO: Use actual directory modification time
				version: 1,
				children: treeNode.children.map(child => ({
					kind: child.kind,
					name: child.name,
					path: child.path,
					depth: child.depth,
					parentPath: child.parentPath,
					size: child.kind === 'file' ? child.size : undefined,
					lastModified: child.kind === 'file' ? child.lastModified : undefined,
					isLoaded: child.kind === 'dir' ? (child.isLoaded ?? false) : undefined,
				})),
				isLoaded: treeNode.isLoaded ?? false,
			}
			
			await workerCache.setDirectory(target.path, cachedEntry)
		} catch (error) {
			console.warn(`Worker failed to cache scan results for ${target.path}:`, error)
		}
	}

	return treeNode
}

const api: TreePrefetchWorkerApi = {
	async init(payload) {
		console.log(`[treePrefetch.worker] init called`, {
			rootPath: payload.rootPath,
			rootName: payload.rootName,
			source: payload.source,
		})
		ctx = createFs(payload.rootHandle)
		fallbackRootName = payload.rootName || 'root'
		
		// Initialize worker cache with shared database schema
		try {
			workerCache = createWorkerTreeCache({
				dbName: 'tree-cache', // Same as main thread
				storeName: 'directories' // Same as main thread
			})
			console.log(`[treePrefetch.worker] workerCache initialized successfully`)
		} catch (error) {
			console.warn('Worker cache initialization failed:', error)
			workerCache = undefined
		}
		
		initialized = true
		console.log(`[treePrefetch.worker] init complete, initialized=${initialized}`)
	},
	async loadDirectory(target) {
		if (!initialized) return undefined
		return loadDirectoryTarget(target)
	},
	async dispose() {
		ctx = undefined
		workerCache = undefined
		initialized = false
	},
}

expose(api)
