import type { FsDirTreeNode } from '@repo/fs'
import { batch, getOwner, onCleanup } from 'solid-js'
import type { FsState } from '../types'
import { createTreePrefetchClient } from '../prefetch/treePrefetchClient'
import type {
	PrefetchDeferredMetadataPayload,
	PrefetchDirectoryLoadedPayload,
	PrefetchErrorPayload,
	PrefetchStatusPayload,
} from '../prefetch/treePrefetchWorkerTypes'
import { createBatchScheduler } from '../utils/schedule'
import { toast } from '@repo/ui/toaster'

type MakeTreePrefetchOptions = {
	state: FsState
	setDirNode: (path: string, node: FsDirTreeNode) => void
	setBatchDirNodes: (nodes: FsDirTreeNode[]) => void
	setLastPrefetchedPath: (path: string | undefined) => void
	setBackgroundPrefetching: (value: boolean) => void
	setBackgroundIndexedFileCount: (value: number) => void
	setPrefetchError: (message: string | undefined) => void
	setPrefetchProcessedCount: (value: number) => void
	setPrefetchLastDurationMs: (value: number) => void
	setPrefetchAverageDurationMs: (value: number) => void
	registerDeferredMetadata: (
		node: PrefetchDeferredMetadataPayload['node']
	) => void
	// Optional caching configuration
	enableCaching?: boolean
}

export const makeTreePrefetch = ({
	state,
	setDirNode,
	setBatchDirNodes,
	setLastPrefetchedPath,
	setBackgroundPrefetching,
	setBackgroundIndexedFileCount,
	setPrefetchError,
	setPrefetchProcessedCount,
	setPrefetchLastDurationMs,
	setPrefetchAverageDurationMs,
	registerDeferredMetadata,
	enableCaching = true, // Default to enabled for persistent tree cache
}: MakeTreePrefetchOptions) => {
	const handlePrefetchStatus = (status: PrefetchStatusPayload) => {
		const shouldShowPrefetching =
			status.running || status.pending > 0 || status.deferred > 0
		batch(() => {
			setBackgroundPrefetching(shouldShowPrefetching)
			setBackgroundIndexedFileCount(status.indexedFileCount)
			setPrefetchProcessedCount(status.processedCount)
			setPrefetchLastDurationMs(status.lastDurationMs)
			setPrefetchAverageDurationMs(status.averageDurationMs)
			if (!status.running && status.pending === 0 && status.deferred === 0) {
				setPrefetchError(undefined)
			}
		})
	}

	const handlePrefetchError = (payload: PrefetchErrorPayload) => {
		setPrefetchError(payload.message)
		toast.warning(payload.message)
	}

	const runPrefetchTask = (
		task: Promise<void> | undefined,
		fallbackMessage: string
	): Promise<void> | undefined => {
		if (!task) return
		return task.catch((error) => {
			handlePrefetchError({
				message: error instanceof Error ? error.message : fallbackMessage,
			})
		})
	}

	// Batch prefetch results to avoid flooding the main thread
	// This collects incoming directories and applies them in chunks with yielding
	const prefetchBatcher = createBatchScheduler<FsDirTreeNode>(
		(nodes) => {
			const latestTree = state.tree
			if (!latestTree) return

			// Apply all nodes in a single tree traversal + single reactivity batch
			batch(() => {
				setBatchDirNodes(nodes)
				const lastNode = nodes[nodes.length - 1]
				if (lastNode) {
					setLastPrefetchedPath(lastNode.path)
				}
			})
		},
		{ maxBatchSize: 50, flushDelayMs: 50 }
	)

	const handlePrefetchResult = (payload: PrefetchDirectoryLoadedPayload) => {
		prefetchBatcher.add(payload.node)
	}

	const handleDeferredMetadata = (_payload: PrefetchDeferredMetadataPayload) => {
		// Disabled: registerDeferredMetadata was updating a store for every deferred
		// directory (thousands in node_modules) but the data was never used anywhere.
		// This was causing main thread to hang.
	}

	const treePrefetchClient = createTreePrefetchClient(
		{
			onDirectoryLoaded: handlePrefetchResult,
			onStatus: handlePrefetchStatus,
			onError: handlePrefetchError,
			onDeferredMetadata: handleDeferredMetadata,
		},
		{
			enableCaching, // Pass through caching configuration
		}
	)
	const disposeTreePrefetchClient = () => treePrefetchClient.dispose()

	if (getOwner()) {
		onCleanup(() => {
			void disposeTreePrefetchClient()
		})
	}

	return {
		treePrefetchClient,
		runPrefetchTask,
		disposeTreePrefetchClient,
	}
}
