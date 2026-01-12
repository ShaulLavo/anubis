import type { FsDirTreeNode } from '@repo/fs'
import type { FsSource } from '../types'
import { IGNORED_SEGMENTS } from '../config/constants'
import type {
	PrefetchDirectoryLoadedPayload,
	PrefetchErrorPayload,
	PrefetchStatusMilestone,
	PrefetchStatusPayload,
	PrefetchTarget,
	TreePrefetchWorkerCallbacks,
	DeferredDirMetadata,
	DirectoryLoadResult,
} from './treePrefetchWorkerTypes'
import { searchService } from '../../search/SearchService'
import type { FileMetadata } from '../../search/types'
import {
	generateShapeFingerprint,
	loadPrefetchCache,
	savePrefetchCache,
	clearPrefetchCache,
} from './prefetchCacheBackend'

const MAX_PREFETCH_DEPTH = 20
const MAX_PREFETCHED_DIRS = Infinity
const STATUS_SAMPLE_INTERVAL = 500 // Only emit status every N directories to reduce main thread load
const BATCH_SIZE = 4 // Smaller batches to reduce per-batch time
const BATCH_DELAY_MS = 16 // Longer delay to give main thread breathing room
const INDEX_BATCH_SIZE = 500 // Larger batch before flushing to SQLite
const CACHE_SAVE_INTERVAL = 200 // Save cache every N directories processed

const now = () =>
	typeof performance !== 'undefined' ? performance.now() : Date.now()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type PrefetchPriority = 'primary' | 'deferred'

type PrefetchQueueOptions = {
	workerCount: number
	/** Load directory with preprocessing done in worker */
	loadDirectory: (target: PrefetchTarget) => Promise<DirectoryLoadResult | undefined>
	/** Extract pending targets from tree (runs in worker) */
	extractPendingTargets: (tree: FsDirTreeNode) => Promise<{
		targets: PrefetchTarget[]
		loadedPaths: string[]
		totalFileCount: number
	}>
	callbacks: TreePrefetchWorkerCallbacks
}

export class PrefetchQueue {
	private readonly primaryQueue = new Map<string, PrefetchTarget>()
	private readonly deferredQueue = new Map<string, PrefetchTarget>()
	private readonly loadedDirPaths = new Set<string>()
	private readonly loadedDirFileCounts = new Map<string, number>()
	private readonly pendingResults: Record<
		PrefetchPriority,
		PrefetchDirectoryLoadedPayload[]
	> = {
		primary: [],
		deferred: [],
	}

	private sessionPrefetchCount = 0
	private processedCount = 0
	private totalDurationMs = 0
	private lastDurationMs = 0
	private indexedFileCount = 0
	private primaryPhaseComplete = false

	private running = false
	private stopRequested = false
	private disposed = false
	private drainPromise: Promise<void> | null = null
	private sessionToken = 0
	private source: FsSource = 'local'
	private runStartTime: number | undefined
	private readonly workerCount: number
	private loggedProcessedCount = 0
	private loggedIndexedCount = 0
	private readonly activeJobs: Record<PrefetchPriority, number> = {
		primary: 0,
		deferred: 0,
	}
	private readonly loggedDeferredPaths = new Set<string>()
	private deferredBytesTotal = 0
	private deferredSample: { path: string } | undefined
	private primaryPhaseLogged = false
	private deferredPhaseLogged = false

	private indexBatch: FileMetadata[] = []
	private indexFlushPromise: Promise<void> | null = null
	private currentShapeFingerprint: string | undefined
	private lastCacheSaveCount = 0
	private cacheRestored = false
	private lastProgressCheck = 0
	private restartWithoutProgressCount = 0

	constructor(private readonly options: PrefetchQueueOptions) {
		this.workerCount = Math.max(1, Math.floor(options.workerCount))
		if (this.workerCount < 1) {
			throw new Error('PrefetchQueue requires at least one worker')
		}
		void searchService.init().catch(() => {
			// Failed to initialize SQLite for indexing
		})
	}

	async resetForSource(source: FsSource) {
		this.source = source
		this.stopRequested = true
		this.sessionToken += 1
		const draining = this.drainPromise
		if (draining) {
			try {
				await draining
			} catch {
				// no-op
			}
		}
		this.stopRequested = false
		this.clearState()
	}

	async seedTree(tree?: FsDirTreeNode) {
		if (!tree) {
			return
		}

		// Extract pending targets in the worker to avoid main thread work
		const { targets, loadedPaths, totalFileCount } =
			await this.options.extractPendingTargets(tree)

		// Update tracking on main thread (lightweight)
		for (const path of loadedPaths) {
			this.loadedDirPaths.add(path)
		}
		this.indexedFileCount = totalFileCount

		this.emitStatus(this.running)
		this.enqueueTargets(targets)
	}

	async enqueueSubtree(node: FsDirTreeNode) {
		if (!node) return
		this.dropTargetFromQueues(node.path)

		// Extract pending targets in worker (avoid main thread work)
		const { targets, loadedPaths, totalFileCount } =
			await this.options.extractPendingTargets(node)

		for (const path of loadedPaths) {
			this.loadedDirPaths.add(path)
		}
		// Add to existing count (don't overwrite)
		this.indexedFileCount += totalFileCount

		this.emitStatus(this.running)
		this.enqueueTargets(targets)
	}

	markDirLoaded(path: string | undefined) {
		if (!path) return
		this.dropTargetFromQueues(path)
		if (this.loadedDirPaths.has(path)) {
			this.emitStatus(this.running)
			return
		}
		this.loadedDirPaths.add(path)
		this.emitStatus(this.running)
	}

	async dispose() {
		this.disposed = true
		this.stopRequested = true
		const draining = this.drainPromise
		if (draining) {
			try {
				await draining
			} catch {
				// no-op
			}
		}
		await this.flushIndexBatch()
		this.primaryQueue.clear()
		this.deferredQueue.clear()
		this.loadedDirPaths.clear()
		this.loadedDirFileCounts.clear()
		this.loggedDeferredPaths.clear()
		this.deferredBytesTotal = 0
		this.deferredSample = undefined
		this.primaryPhaseLogged = false
		this.deferredPhaseLogged = false
	}

	private clearState() {
		this.primaryQueue.clear()
		this.deferredQueue.clear()
		this.loadedDirPaths.clear()
		this.loadedDirFileCounts.clear()
		this.pendingResults.primary.length = 0
		this.pendingResults.deferred.length = 0
		this.sessionPrefetchCount = 0
		this.processedCount = 0
		this.totalDurationMs = 0
		this.lastDurationMs = 0
		this.indexedFileCount = 0
		this.runStartTime = undefined
		this.loggedProcessedCount = 0
		this.loggedIndexedCount = 0
		this.primaryPhaseComplete = false
		this.activeJobs.primary = 0
		this.activeJobs.deferred = 0
		this.primaryPhaseLogged = false
		this.deferredPhaseLogged = false
		// Reset cache tracking (but don't clear persistent cache)
		this.currentShapeFingerprint = undefined
		this.lastCacheSaveCount = 0
		this.cacheRestored = false
		this.lastProgressCheck = 0
		this.restartWithoutProgressCount = 0
		this.emitStatus(false)
	}

	private hasPrefetchBudget() {
		return (
			this.sessionPrefetchCount < MAX_PREFETCHED_DIRS &&
			this.loadedDirPaths.size < MAX_PREFETCHED_DIRS
		)
	}

	private hasPendingTargets() {
		return this.primaryQueue.size > 0 || this.deferredQueue.size > 0
	}

	private shouldDeferPath(path: string | undefined) {
		if (!path) return false
		const segments = path.split('/').filter(Boolean)
		return segments.some((segment) => IGNORED_SEGMENTS.has(segment))
	}

	private shouldSkipTarget(target: PrefetchTarget) {
		if (!target.path) return true
		if (target.depth > MAX_PREFETCH_DEPTH) return true
		if (this.loadedDirPaths.has(target.path)) return true
		return false
	}

	private enqueueTargets(targets: readonly PrefetchTarget[]) {
		let added = false
		for (const target of targets) {
			if (!this.hasPrefetchBudget()) break
			if (this.shouldSkipTarget(target)) continue
			const isDeferred = this.shouldDeferPath(target.path)
			const queue = isDeferred ? this.deferredQueue : this.primaryQueue
			if (queue.has(target.path)) continue
			queue.set(target.path, target)
			if (!isDeferred) {
				this.primaryPhaseComplete = false
				this.primaryPhaseLogged = false
			} else {
				this.deferredPhaseLogged = false
			}
			added = true
		}

		if (added) {
			this.scheduleProcessing()
		}
	}

	private scheduleProcessing() {
		if (this.disposed || this.stopRequested) return
		if (this.drainPromise) return
		if (!this.hasPendingTargets()) return
		if (!this.hasPrefetchBudget()) {
			this.primaryQueue.clear()
			this.deferredQueue.clear()
			return
		}

		this.running = true
		if (this.runStartTime === undefined) {
			this.runStartTime = now()
		}
		this.emitStatus(true)
		this.drainPromise = Promise.all(
			Array.from({ length: this.workerCount }, () =>
				this.workerLoop(this.sessionToken)
			)
		)
			.then(() => undefined)
			.finally(() => {
				this.drainPromise = null
				this.running = false
				this.emitStatus(false)
				this.logCompletion()
				const pending = this.hasPendingTargets()
				if (!this.disposed && pending) {
					// Check if we're making progress
					if (this.processedCount === this.lastProgressCheck) {
						this.restartWithoutProgressCount++
						if (this.restartWithoutProgressCount >= 3) {
							// Don't restart again - we're stuck
							return
						}
					} else {
						this.lastProgressCheck = this.processedCount
						this.restartWithoutProgressCount = 0
					}
					this.scheduleProcessing()
				}
			})
	}

	private takeFromQueue(
		queue: Map<string, PrefetchTarget>
	): PrefetchTarget | undefined {
		const iterator = queue.entries().next()
		if (iterator.done) {
			return undefined
		}
		const [path, target] = iterator.value
		queue.delete(path)
		return target
	}

	private dequeueNextTarget():
		| { target: PrefetchTarget; priority: PrefetchPriority }
		| undefined {
		const primaryTarget = this.takeFromQueue(this.primaryQueue)
		if (primaryTarget) {
			return { target: primaryTarget, priority: 'primary' }
		}

		// Primary queue is empty - check if we can move to deferred phase
		if (!this.primaryPhaseComplete && this.activeJobs.primary === 0) {
			this.markPrimaryPhaseComplete()
		}

		// Try deferred queue (even if activeJobs.primary > 0 to avoid getting stuck)
		const deferredTarget = this.takeFromQueue(this.deferredQueue)
		if (deferredTarget) {
			if (!this.primaryPhaseComplete && this.activeJobs.primary === 0) {
				this.markPrimaryPhaseComplete()
			}
			return { target: deferredTarget, priority: 'deferred' }
		}

		if (this.activeJobs.deferred === 0) {
			this.flushPhaseResults('deferred')
			if (!this.deferredPhaseLogged) {
				this.deferredPhaseLogged = true
				this.logPhaseCompletion('deferred')
			}
		}

		return undefined
	}

	private flushPhaseResults(priority: PrefetchPriority) {
		if (priority === 'deferred') {
			this.pendingResults.deferred.length = 0
			return
		}
		const pending = this.pendingResults[priority]
		if (!pending.length) return
		while (pending.length) {
			const payload = pending.shift()
			if (!payload) continue
			this.options.callbacks.onDirectoryLoaded(payload)
		}
	}

	private markPrimaryPhaseComplete() {
		if (!this.primaryPhaseComplete) {
			this.primaryPhaseComplete = true
		}
		this.flushPhaseResults('primary')
		if (!this.primaryPhaseLogged) {
			this.primaryPhaseLogged = true
			this.logPhaseCompletion('primary')
		}
	}

	private logDeferredPayload(node: DeferredDirMetadata) {
		const path = node.path || node.name
		if (this.loggedDeferredPaths.has(path)) return
		this.loggedDeferredPaths.add(path)
		const byteLength =
			typeof Blob !== 'undefined'
				? new Blob([JSON.stringify(node)]).size
				: new TextEncoder().encode(JSON.stringify(node)).byteLength
		this.deferredBytesTotal += byteLength
		if (!this.deferredSample) {
			this.deferredSample = { path }
		}
	}

	private async workerLoop(sessionToken: number) {
		while (
			!this.disposed &&
			!this.stopRequested &&
			sessionToken === this.sessionToken
		) {
			if (!this.hasPrefetchBudget()) {
				this.primaryQueue.clear()
				this.deferredQueue.clear()
				return
			}

			const next = this.dequeueNextTarget()
			if (!next) {
				return
			}

			const jobStart = now()
			const { target, priority } = next
			this.activeJobs[priority] += 1

			try {
				const result = await this.options.loadDirectory(target)
				if (sessionToken !== this.sessionToken) {
					return
				}
				if (!result) {
					// Directory failed to load or timed out - skip it and continue
					continue
				}

				// Use pre-computed data from worker (no main thread tree traversal!)
				const { node: subtree, pendingTargets, fileCount, filesToIndex } = result

				this.sessionPrefetchCount += 1
				this.loadedDirPaths.add(subtree.path ?? '')
				this.indexedFileCount += fileCount

				// Queue files for search indexing
				if (filesToIndex.length > 0) {
					this.indexBatch.push(...filesToIndex)
					if (this.indexBatch.length >= INDEX_BATCH_SIZE) {
						void this.flushIndexBatch()
					}
				}

				const payload: PrefetchDirectoryLoadedPayload = { node: subtree }
				if (priority === 'primary') {
					this.pendingResults.primary.push(payload)
				} else {
					const deferredMetadata: DeferredDirMetadata = {
						kind: subtree.kind,
						name: subtree.name,
						path: subtree.path,
						parentPath: subtree.parentPath,
						depth: subtree.depth,
						isLoaded: subtree.isLoaded,
					}
					this.logDeferredPayload(deferredMetadata)
					this.options.callbacks.onDeferredMetadata?.({
						node: deferredMetadata,
					})
				}
				this.enqueueTargets(pendingTargets)
				if (!this.hasPrefetchBudget()) {
					this.primaryQueue.clear()
					this.deferredQueue.clear()
				}
				const duration = now() - jobStart
				this.lastDurationMs = duration
				this.totalDurationMs += duration
				this.processedCount += 1
				// Only emit status every STATUS_SAMPLE_INTERVAL to avoid overwhelming main thread
				if (this.processedCount % STATUS_SAMPLE_INTERVAL === 0) {
					this.emitStatus(true, true)
				}
				this.maybeSaveCache()
				if (this.processedCount % BATCH_SIZE === 0) {
					await delay(BATCH_DELAY_MS)
				}
			} catch (error) {
				if (sessionToken !== this.sessionToken) {
					return
				}
				const message =
					error instanceof Error
						? error.message
						: 'Failed to prefetch directory'
				const payload: PrefetchErrorPayload = { message }
				this.options.callbacks.onError?.(payload)
			} finally {
				this.activeJobs[priority] -= 1
				if (
					priority === 'primary' &&
					this.primaryQueue.size === 0 &&
					this.activeJobs.primary === 0
				) {
					this.markPrimaryPhaseComplete()
				}
				if (
					priority === 'deferred' &&
					this.deferredQueue.size === 0 &&
					this.activeJobs.deferred === 0
				) {
					this.flushPhaseResults('deferred')
					if (!this.deferredPhaseLogged) {
						this.deferredPhaseLogged = true
						this.logPhaseCompletion('deferred')
					}
				}
			}
		}
	}

	private dropTargetFromQueues(path: string | undefined) {
		if (!path) return
		this.primaryQueue.delete(path)
		this.deferredQueue.delete(path)
	}

	private async flushIndexBatch() {
		if (this.indexBatch.length === 0) return
		const batch = [...this.indexBatch]
		this.indexBatch = []

		// SQLite runs in a separate worker, so this just sends data via comlink
		try {
			await searchService.indexFiles(batch)
		} catch {
			// Failed to batch insert files to SQLite
		}
	}

	private emitStatus(running: boolean, milestone = false) {
		const payload: PrefetchStatusPayload = {
			running,
			pending: this.primaryQueue.size,
			deferred: this.deferredQueue.size,
			indexedFileCount: this.indexedFileCount,
			processedCount: this.processedCount,
			lastDurationMs: this.lastDurationMs,
			averageDurationMs: this.processedCount
				? this.totalDurationMs / this.processedCount
				: 0,
		}

		if (milestone) {
			const milestonePayload: PrefetchStatusMilestone = {
				processedCount: this.processedCount,
				pending: this.primaryQueue.size,
				deferred: this.deferredQueue.size,
				indexedFileCount: this.indexedFileCount,
				lastDurationMs: this.lastDurationMs,
				averageDurationMs: payload.averageDurationMs,
			}
			payload.milestone = milestonePayload
		}

		this.options.callbacks.onStatus(payload)
	}

	private logCompletion() {
		const hasWork = this.running || this.hasPendingTargets()
		if (hasWork) {
			return
		}

		void this.flushIndexBatch()

		const processedDelta = this.processedCount - this.loggedProcessedCount
		if (processedDelta <= 0) {
			return
		}

		this.runStartTime = undefined
		this.loggedProcessedCount = this.processedCount
		this.loggedIndexedCount = this.indexedFileCount

		// Save final cache state when prefetch completes
		void this.saveToCache()
	}

	private logPhaseCompletion(_kind: PrefetchPriority) {
		// Phase completion logged
	}

	/**
	 * Try to restore prefetch progress from the cache.
	 * Returns true if cache was restored successfully.
	 */
	async tryRestoreFromCache(rootChildren: string[]): Promise<boolean> {
		if (this.cacheRestored) return false

		try {
			const cached = await loadPrefetchCache()
			if (!cached) return false

			// Check for old cache format (had loadedDirPaths instead of loadedDirFileCounts)
			if (!cached.loadedDirFileCounts) {
				await clearPrefetchCache()
				return false
			}

			const currentFingerprint = generateShapeFingerprint(rootChildren)
			this.currentShapeFingerprint = currentFingerprint

			// Check if the filesystem shape has changed
			if (cached.shapeFingerprint !== currentFingerprint) {
				// Shape changed - invalidate cache and start fresh
				await clearPrefetchCache()
				return false
			}

			// Restore file counts from cache - this prevents double-counting when we
			// re-walk directories. We DON'T restore loadedDirPaths because that would
			// skip directories without enqueuing their children (we don't cache tree data).
			// Instead, we re-walk everything but use cached counts to compute correct deltas.
			for (const [path, count] of Object.entries(cached.loadedDirFileCounts)) {
				this.loadedDirFileCounts.set(path, count)
			}
			this.indexedFileCount = cached.indexedFileCount
			this.lastCacheSaveCount = this.loadedDirFileCounts.size
			this.cacheRestored = true

			// Emit status so UI shows the cached indexed count immediately
			this.emitStatus(false)

			// Return false to still seed the tree - we'll re-walk but won't double-count
			return false
		} catch {
			return false
		}
	}

	/**
	 * Save current prefetch progress to the cache.
	 */
	private async saveToCache(): Promise<void> {
		if (!this.currentShapeFingerprint) return

		try {
			await savePrefetchCache({
				loadedDirFileCounts: Object.fromEntries(this.loadedDirFileCounts),
				indexedFileCount: this.indexedFileCount,
				shapeFingerprint: this.currentShapeFingerprint,
				savedAt: Date.now(),
			})
			this.lastCacheSaveCount = this.loadedDirFileCounts.size
		} catch {
			// Ignore cache save errors
		}
	}

	/**
	 * Maybe save the cache if enough progress has been made since last save.
	 */
	private maybeSaveCache(): void {
		const progress = this.loadedDirFileCounts.size - this.lastCacheSaveCount
		if (progress >= CACHE_SAVE_INTERVAL) {
			void this.saveToCache()
		}
	}

	/**
	 * Set the shape fingerprint from the root directory's children.
	 * Call this when seeding the tree to enable cache validation.
	 */
	setShapeFingerprint(rootChildren: string[]): void {
		this.currentShapeFingerprint = generateShapeFingerprint(rootChildren)
	}

	/**
	 * Clear the prefetch cache (useful when the user wants a fresh start).
	 */
	async clearCache(): Promise<void> {
		await clearPrefetchCache()
		this.cacheRestored = false
		this.lastCacheSaveCount = 0
	}
}
