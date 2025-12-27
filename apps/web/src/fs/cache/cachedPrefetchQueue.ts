import type { FsDirTreeNode } from '@repo/fs'
import { logger } from '~/logger'
import { PrefetchQueue } from '../prefetch/prefetchQueue'
import type {
	PrefetchTarget,
	TreePrefetchWorkerCallbacks,
} from '../prefetch/treePrefetchWorkerTypes'
import { TreeCacheController } from './treeCacheController'

const cacheLogger = logger.withTag('cached-prefetch')

export interface CachedPrefetchQueueOptions {
	workerCount: number
	loadDirectory: (target: PrefetchTarget) => Promise<FsDirTreeNode | undefined>
	callbacks: TreePrefetchWorkerCallbacks
	cacheController?: TreeCacheController
}

export class CachedPrefetchQueue extends PrefetchQueue {
	private readonly cacheController: TreeCacheController
	private readonly originalLoadDirectory: (
		target: PrefetchTarget
	) => Promise<FsDirTreeNode | undefined>
	private readonly callbacks: TreePrefetchWorkerCallbacks

	constructor(options: CachedPrefetchQueueOptions) {
		const originalLoader = options.loadDirectory

		super({
			workerCount: options.workerCount,
			loadDirectory: (target) => this.loadDirectoryWithCache(target),
			callbacks: options.callbacks,
		})

		this.originalLoadDirectory = originalLoader
		this.callbacks = options.callbacks
		this.cacheController = options.cacheController ?? new TreeCacheController()
		cacheLogger.debug('CachedPrefetchQueue initialized')
	}

	async seedTree(tree?: FsDirTreeNode) {
		if (!tree) return

		// Cache-first startup: load cached tree immediately for instant display
		const cachedTree = await this.cacheController.getCachedTree(tree.path)
		if (cachedTree) {
			cacheLogger.debug('Cache-first startup: displaying cached tree immediately', {
				path: tree.path,
				childrenCount: cachedTree.children.length,
			})

			// Display cached tree immediately
			super.seedTree(cachedTree)

			// Start background validation of all cached directories
			this.validateTreeInBackground(tree).catch(error => {
				cacheLogger.warn('Background tree validation failed', {
					path: tree.path,
					error,
				})
			})
		} else {
			cacheLogger.debug(
				'No cached tree available, proceeding with normal loading',
				{ path: tree.path }
			)
			super.seedTree(tree)
		}

		// Always cache the provided tree data
		await this.cacheController.setCachedTree(tree.path, tree)
	}

	private async validateTreeInBackground(tree: FsDirTreeNode): Promise<void> {
		try {
			cacheLogger.debug('Starting background tree validation', {
				path: tree.path,
			})

			// Validate all directories in the tree structure
			const validationPromises: Promise<void>[] = []

			const validateDirectory = async (node: FsDirTreeNode) => {
				// Skip if not a directory or not loaded
				if (node.kind !== 'dir' || !node.isLoaded) {
					return
				}

				const target: PrefetchTarget = {
					path: node.path,
					name: node.name,
					depth: node.depth,
					parentPath: node.parentPath,
				}

				// Get cached data for comparison
				const cachedNode = await this.cacheController.getCachedDirectory(node.path)
				if (cachedNode) {
					await this.validateInBackground(target, cachedNode)
				}

				// Recursively validate child directories
				for (const child of node.children) {
					if (child.kind === 'dir' && child.isLoaded) {
						validationPromises.push(validateDirectory(child))
					}
				}
			}

			await validateDirectory(tree)
			await Promise.all(validationPromises)

			cacheLogger.debug('Background tree validation completed', {
				path: tree.path,
			})
		} catch (error) {
			cacheLogger.warn('Background tree validation error', {
				path: tree.path,
				error,
			})
		}
	}

	private async loadDirectoryWithCache(
		target: PrefetchTarget
	): Promise<FsDirTreeNode | undefined> {
		const startTime = performance.now()

		try {
			// First, try to get cached data for immediate display
			const cachedNode = await this.cacheController.getCachedDirectory(target.path)
			
			if (cachedNode) {
				cacheLogger.debug('Displaying cached data immediately', {
					path: target.path,
					childrenCount: cachedNode.children.length,
				})

				// Trigger background validation (don't await) - use setTimeout to ensure it runs asynchronously
				setTimeout(() => {
					this.validateInBackground(target, cachedNode).catch(error => {
						cacheLogger.warn('Background validation failed', {
							path: target.path,
							error,
						})
					})
				}, 0)

				// Return the cached data immediately
				return this.convertCachedToTreeNode(cachedNode)
			}

			// No cached data available, perform fresh load
			const freshNode = await this.originalLoadDirectory(target)

			if (!freshNode) {
				return undefined
			}

			await this.populateCacheFromScan(target.path, freshNode)

			const loadTime = performance.now() - startTime
			cacheLogger.debug('Loaded and cached directory (no cache available)', {
				path: target.path,
				childrenCount: freshNode.children.length,
				loadTime,
			})

			return freshNode
		} catch (error) {
			cacheLogger.warn('Failed to load directory with cache', {
				path: target.path,
				error,
			})
			throw error
		}
	}

	private async validateInBackground(
		target: PrefetchTarget,
		cachedNode: any
	): Promise<void> {
		try {
			cacheLogger.debug('Starting background validation', { path: target.path })

			// Perform fresh filesystem scan in background
			const freshNode = await this.originalLoadDirectory(target)

			if (!freshNode) {
				cacheLogger.debug('Background validation: no fresh data found', {
					path: target.path,
				})
				return
			}

			// Check if data has changed
			const hasChanged = this.hasDataChanged(cachedNode, freshNode)

			if (hasChanged) {
				cacheLogger.debug('Background validation: changes detected, updating cache and UI', {
					path: target.path,
					cachedChildren: cachedNode.children?.length || 0,
					freshChildren: freshNode.children.length,
				})

				// Update cache with fresh data
				await this.populateCacheFromScan(target.path, freshNode)

				// Notify UI of changes through callbacks
				this.callbacks.onDirectoryLoaded({
					node: freshNode,
				})
			} else {
				cacheLogger.debug('Background validation: no changes detected', {
					path: target.path,
				})
			}
		} catch (error) {
			cacheLogger.warn('Background validation error', {
				path: target.path,
				error,
			})
		}
	}

	private hasDataChanged(cachedNode: any, freshNode: FsDirTreeNode): boolean {
		// Simple change detection based on children count and names
		const cachedChildren = cachedNode.children || []
		const freshChildren = freshNode.children || []

		if (cachedChildren.length !== freshChildren.length) {
			return true
		}

		// Check if child names have changed
		const cachedNames = new Set(cachedChildren.map((child: any) => child.name))
		const freshNames = new Set(freshChildren.map(child => child.name))

		for (const name of freshNames) {
			if (!cachedNames.has(name)) {
				return true
			}
		}

		for (const name of cachedNames) {
			if (!freshNames.has(name)) {
				return true
			}
		}

		return false
	}

	private convertCachedToTreeNode(cached: any): FsDirTreeNode {
		const children = cached.children.map((child: any) => {
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

		return {
			kind: 'dir',
			name: cached.name,
			path: cached.path,
			depth: cached.depth,
			parentPath: cached.parentPath,
			children,
			isLoaded: cached.isLoaded,
		}
	}

	private async shouldSkipCachedTarget(
		target: PrefetchTarget
	): Promise<boolean> {
		if (!target.path) return false

		try {
			const cachedNode = await this.cacheController.getCachedDirectory(
				target.path
			)
			if (!cachedNode) {
				return false
			}

			// TODO: Implement modification time checking when directory handles provide mtime
			const isFresh = await this.cacheController.isDirectoryFresh(target.path)

			if (isFresh) {
				cacheLogger.debug('Using fresh cached data, skipping load', {
					path: target.path,
				})
				return true
			}

			return false
		} catch (error) {
			cacheLogger.warn('Error checking cache freshness, proceeding with load', {
				path: target.path,
				error,
			})
			return false
		}
	}

	private async populateCacheFromScan(
		path: string,
		node: FsDirTreeNode
	): Promise<void> {
		try {
			await this.cacheController.setCachedDirectory(path, node)
			cacheLogger.debug('Populated cache from scan', {
				path,
				childrenCount: node.children.length,
			})
		} catch (error) {
			cacheLogger.warn('Failed to populate cache from scan', { path, error })
		}
	}

	private async validateCacheEntry(
		path: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		entry: FsDirTreeNode
	): Promise<boolean> {
		try {
			// TODO: Implement proper validation using directory modification times
			return true
		} catch (error) {
			cacheLogger.warn('Failed to validate cache entry', { path, error })
			return false
		}
	}

	async clearCache(): Promise<void> {
		await this.cacheController.clearCache()
		cacheLogger.info('Cleared cache data')
	}

	async getCacheStats() {
		return await this.cacheController.getCacheStats()
	}
}
