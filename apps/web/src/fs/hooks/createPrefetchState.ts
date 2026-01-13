import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { DeferredDirMetadata } from '../prefetch/treePrefetchWorkerTypes'
import { createPrefetchIndicators } from './createPrefetchIndicators'
import type { FilePath } from '@repo/fs'
import { createFilePath } from '@repo/fs'

export const createPrefetchState = () => {
	const {
		backgroundPrefetching,
		setBackgroundPrefetching,
		backgroundIndexedFileCount,
		setBackgroundIndexedFileCount,
		lastPrefetchedPath,
		setLastPrefetchedPath,
		prefetchError,
		setPrefetchError,
	} = createPrefetchIndicators()
	const [prefetchProcessedCount, setPrefetchProcessedCount] = createSignal(0)
	const [prefetchLastDurationMs, setPrefetchLastDurationMs] = createSignal(0)
	const [prefetchAverageDurationMs, setPrefetchAverageDurationMs] =
		createSignal(0)
	const [deferredMetadata, setDeferredMetadata] = createStore<
		Record<FilePath, DeferredDirMetadata>
	>({} as Record<FilePath, DeferredDirMetadata>)

	const registerDeferredMetadata = (node: DeferredDirMetadata) => {
		const rawKey = node.path || `${node.parentPath ?? ''}/${node.name}`
		const key = createFilePath(rawKey)
		setDeferredMetadata(key, () => node)
	}

	const clearDeferredMetadata = () => {
		setDeferredMetadata(() => ({} as Record<FilePath, DeferredDirMetadata>))
	}

	return {
		backgroundPrefetching,
		setBackgroundPrefetching,
		backgroundIndexedFileCount,
		setBackgroundIndexedFileCount,
		lastPrefetchedPath,
		setLastPrefetchedPath,
		prefetchError,
		setPrefetchError,
		prefetchProcessedCount,
		setPrefetchProcessedCount,
		prefetchLastDurationMs,
		setPrefetchLastDurationMs,
		prefetchAverageDurationMs,
		setPrefetchAverageDurationMs,
		deferredMetadata,
		registerDeferredMetadata,
		clearDeferredMetadata,
	}
}
