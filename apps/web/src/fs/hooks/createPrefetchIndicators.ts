import { createSignal } from 'solid-js'
import type { FilePath } from '@repo/fs'

export const createPrefetchIndicators = () => {
	const [backgroundPrefetching, setBackgroundPrefetching] = createSignal(false)
	const [backgroundIndexedFileCount, setBackgroundIndexedFileCount] =
		createSignal(0)
	const [lastPrefetchedPath, setLastPrefetchedPath] = createSignal<
		FilePath | undefined
	>(undefined)
	const [prefetchError, setPrefetchError] = createSignal<string | undefined>(
		undefined
	)

	return {
		backgroundPrefetching,
		setBackgroundPrefetching,
		backgroundIndexedFileCount,
		setBackgroundIndexedFileCount,
		lastPrefetchedPath,
		setLastPrefetchedPath,
		prefetchError,
		setPrefetchError,
	}
}
