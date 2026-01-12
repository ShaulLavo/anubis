import { createStore, reconcile } from 'solid-js/store'
import type { SelectionRange } from '../store/types'

/**
 * Normalize path by stripping leading slash.
 * Cache keys use normalized paths (without leading slash).
 */
const normalizePath = (path: string): string =>
	path.startsWith('/') ? path.slice(1) : path

export const createSelectionsState = () => {
	const [fileSelections, setFileSelectionsStore] = createStore<
		Record<string, SelectionRange[] | undefined>
	>({})

	const setSelections = (path: string, selections?: SelectionRange[]) => {
		if (!path) return
		const p = normalizePath(path)
		if (!selections) {
			setFileSelectionsStore(p, undefined)
			return
		}

		setFileSelectionsStore(p, selections)
	}

	const clearSelections = () => {
		setFileSelectionsStore(reconcile({}))
	}

	return {
		fileSelections,
		setSelections,
		clearSelections,
	}
}
