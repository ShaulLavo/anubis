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
} from './treePrefetchWorkerTypes'
import { searchService } from '../../search/SearchService'
import type { FileMetadata } from '../../search/types'
import {
	generateShapeFingerprint,
	loadPrefetchCache,
	savePrefetchCache,
	clearPrefetchCache,
} from './prefetchCacheBackend'

const MAX_PREFETCH_DEPTH = 6
const MAX_PREFETCHED_DIRS = Infinity
const STATUS_SAMPLE_INTERVAL = 50
const BATCH_SIZE = 8
const BATCH_DELAY_MS = 4
const INDEX_BATCH_SIZE = 100
const CACHE_SAVE_INTERVAL = 100 // Save cache every N directories processed

const now = () =>
	typeof performance !== 'undefined' ? performance.now() : Date.now()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type PrefetchPriority = 'primary' | 'deferred'

type PrefetchQueueOptions = {
	workerCount: number
	loadDirectory: (target: PrefetchTarget) => Promise<FsDirTreeNode | undefined>
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

		const pending = this.ingestLoadedSubtree(tree)

		this.emitStatus(this.running)
		this.enqueueTargets(pending)
	}

	enqueueSubtree(node: FsDirTreeNode) {
		if (!node) return
		this.dropTargetFromQueues(node.path)
		const pending = this.ingestLoadedSubtree(node)
		this.emitStatus(this.running)
		this.enqueueTargets(pending)
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
				if (!this.disposed && this.hasPendingTargets()) {
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
		if (!this.primaryPhaseComplete) {
			if (this.activeJobs.primary === 0) {
				// No active primary jobs, safe to mark complete
				this.markPrimaryPhaseComplete()
			} else {
				// There are active primary jobs - but if WE are the only worker
				// still running (others have exited), we should NOT return undefined
				// because no one else will mark primary complete.
				// Instead, try to get a deferred target to keep making progress.
				// The active primary job counter will be decremented when it finishes.
				// This is a workaround for the race condition where workers exit
				// while waiting for a primary job that's actually already done.
				console.debug('[Prefetch] Primary queue empty but activeJobs.primary > 0, checking deferred anyway')
			}
		}

		// Always try deferred queue if primary is empty
		// (primaryPhaseComplete might be false if activeJobs.primary > 0, but we still want to make progress)
		if (this.primaryQueue.size === 0) {
			console.debug('[Prefetch] Checking deferred queue, size:', this.deferredQueue.size)
			const deferredTarget = this.takeFromQueue(this.deferredQueue)
			if (deferredTarget) {
				console.debug('[Prefetch] Got deferred target:', deferredTarget.path)
				// If we're taking a deferred target while primary isn't "complete",
				// mark it complete now since primary queue is empty
				if (!this.primaryPhaseComplete && this.activeJobs.primary === 0) {
					this.markPrimaryPhaseComplete()
				}
				return { target: deferredTarget, priority: 'deferred' }
			}
			// Deferred queue is empty
			console.debug('[Prefetch] Deferred queue empty, activeJobs:', {
				primary: this.activeJobs.primary,
				deferred: this.activeJobs.deferred,
			})
			if (this.activeJobs.deferred === 0) {
				this.flushPhaseResults('deferred')
				if (!this.deferredPhaseLogged) {
					this.deferredPhaseLogged = true
					this.logPhaseCompletion('deferred')
				}
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
				// Debug: log why worker is exiting with no target
				if (this.primaryQueue.size > 0 || this.deferredQueue.size > 0) {
					console.warn('[Prefetch] Worker exiting but queues not empty:', {
						primaryQueue: this.primaryQueue.size,
						deferredQueue: this.deferredQueue.size,
						primaryPhaseComplete: this.primaryPhaseComplete,
						activeJobs: {
							primary: this.activeJobs.primary,
							deferred: this.activeJobs.deferred,
						},
					})
				}
				return
			}

			const jobStart = now()
			const { target, priority } = next
			this.activeJobs[priority] += 1

			try {
				// Debug: log when starting a job
				if (priority === 'deferred') {
					console.debug('[Prefetch] Starting deferred job:', target.path)
				}
				// Worker handles timeout internally and returns undefined on timeout
				const subtree = await this.options.loadDirectory(target)
				if (sessionToken !== this.sessionToken) {
					return
				}
				if (!subtree) {
					// Directory failed to load or timed out - skip it and continue
					continue
				}
				this.sessionPrefetchCount += 1
				const pending = this.ingestLoadedSubtree(subtree)
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
				this.enqueueTargets(pending)
				if (!this.hasPrefetchBudget()) {
					this.primaryQueue.clear()
					this.deferredQueue.clear()
				}
				const duration = now() - jobStart
				this.lastDurationMs = duration
				this.totalDurationMs += duration
				this.processedCount += 1
				const milestoneReached =
					this.processedCount > 0 &&
					this.processedCount % STATUS_SAMPLE_INTERVAL === 0
				this.emitStatus(true, milestoneReached)
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

	private trackLoadedDirectory(dir: FsDirTreeNode) {
		if (dir.kind !== 'dir') return
		if (dir.isLoaded === false) return
		const path = dir.path ?? ''
		this.loadedDirPaths.add(path)
		const children = dir.children

		const filesToIndex: FileMetadata[] = []

		const fileCount = !children
			? 0
			: children.reduce((count, child) => {
					if (child.kind === 'file') {
						filesToIndex.push({ path: child.path, kind: 'file' })
						return count + 1
					} else if (child.kind === 'dir') {
						filesToIndex.push({ path: child.path, kind: 'dir' })
					}
					return count
				}, 0)

		if (filesToIndex.length > 0) {
			this.indexBatch.push(...filesToIndex)
			if (this.indexBatch.length >= INDEX_BATCH_SIZE) {
				void this.flushIndexBatch()
			}
		}

		const previous = this.loadedDirFileCounts.get(path) ?? 0
		if (fileCount === previous) return
		this.loadedDirFileCounts.set(path, fileCount)
		this.indexedFileCount += fileCount - previous
	}

	private async flushIndexBatch() {
		if (this.indexBatch.length === 0) return
		const batch = [...this.indexBatch]
		this.indexBatch = []

		try {
			await searchService.indexFiles(batch)
		} catch {
			// Failed to batch insert files to SQLite
		}
	}

	private ingestLoadedSubtree(node: FsDirTreeNode) {
		if (node.kind !== 'dir') return [] as PrefetchTarget[]
		const stack: FsDirTreeNode[] = [node]
		const pending: PrefetchTarget[] = []

		while (stack.length) {
			const dir = stack.pop()!
			this.trackLoadedDirectory(dir)

			for (const child of dir.children) {
				if (child.kind !== 'dir') continue
				if (child.isLoaded === false) {
					pending.push({
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

		return pending
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

		// Debug: log when status changes to help diagnose stuck state
		if (!running && (this.primaryQueue.size > 0 || this.deferredQueue.size > 0)) {
			console.warn('[Prefetch] Workers stopped but queues not empty:', {
				running,
				primaryQueue: this.primaryQueue.size,
				deferredQueue: this.deferredQueue.size,
				primaryPhaseComplete: this.primaryPhaseComplete,
				activeJobs: { ...this.activeJobs },
			})
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

			const currentFingerprint = generateShapeFingerprint(rootChildren)
			this.currentShapeFingerprint = currentFingerprint

			// Check if the filesystem shape has changed
			if (cached.shapeFingerprint !== currentFingerprint) {
				// Shape changed - invalidate cache and start fresh
				await clearPrefetchCache()
				return false
			}

			// Restore the state
			for (const path of cached.loadedDirPaths) {
				this.loadedDirPaths.add(path)
			}
			this.indexedFileCount = cached.indexedFileCount
			this.lastCacheSaveCount = cached.loadedDirPaths.length
			this.cacheRestored = true

			return true
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
				loadedDirPaths: Array.from(this.loadedDirPaths),
				indexedFileCount: this.indexedFileCount,
				shapeFingerprint: this.currentShapeFingerprint,
				savedAt: Date.now(),
			})
			this.lastCacheSaveCount = this.loadedDirPaths.size
		} catch {
			// Ignore cache save errors
		}
	}

	/**
	 * Maybe save the cache if enough progress has been made since last save.
	 */
	private maybeSaveCache(): void {
		const progress = this.loadedDirPaths.size - this.lastCacheSaveCount
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
