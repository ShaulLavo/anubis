import { createStore, reconcile } from 'solid-js/store'
import type { CursorPosition } from '../store/types'

/**
 * Normalize path by stripping leading slash.
 * Cache keys use normalized paths (without leading slash).
 */
const normalizePath = (path: string): string =>
	path.startsWith('/') ? path.slice(1) : path

export const createCursorPositionState = () => {
	const [cursorPositions, setCursorPositionsStore] = createStore<
		Record<string, CursorPosition | undefined>
	>({})

	const setCursorPosition = (path: string, position?: CursorPosition) => {
		if (!path) return
		const p = normalizePath(path)
		if (!position) {
			setCursorPositionsStore(p, undefined)
			return
		}

		setCursorPositionsStore(p, position)
	}

	const clearCursorPositions = () => {
		setCursorPositionsStore(reconcile({}))
	}

	return {
		cursorPositions,
		setCursorPosition,
		clearCursorPositions,
	}
}
