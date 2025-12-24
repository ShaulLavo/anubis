import { createStore, reconcile } from 'solid-js/store'
import type { TreeSitterCapture } from '../../workers/treeSitterWorkerTypes'

/**
 * Represents a pending offset transformation for highlights.
 * Instead of recreating 10k highlight objects per keystroke,
 * we store this lightweight offset and apply it lazily.
 */
export type HighlightTransform = {
	charDelta: number
	lineDelta: number
	fromCharIndex: number
	fromLineRow: number
}

export const createHighlightState = () => {
	const [fileHighlights, setHighlightsStore] = createStore<
		Record<string, TreeSitterCapture[] | undefined>
	>({})

	// Track pending offsets per file - O(1) update instead of O(n) array recreation
	const [highlightOffsets, setHighlightOffsets] = createStore<
		Record<string, HighlightTransform | undefined>
	>({})

	/**
	 * Apply an offset transformation optimistically.
	 * This is O(1) - just updates a single object, no array recreation.
	 * Multiple rapid edits accumulate into a single offset.
	 */
	const applyHighlightOffset = (
		path: string,
		transform: HighlightTransform
	) => {
		if (!path) return
		const existing = highlightOffsets[path]
		if (existing) {
			// Accumulate offsets from rapid edits
			setHighlightOffsets(path, {
				charDelta: existing.charDelta + transform.charDelta,
				lineDelta: existing.lineDelta + transform.lineDelta,
				fromCharIndex: Math.min(
					existing.fromCharIndex,
					transform.fromCharIndex
				),
				fromLineRow: Math.min(existing.fromLineRow, transform.fromLineRow),
			})
		} else {
			setHighlightOffsets(path, transform)
		}
	}

	/**
	 * Set highlights from tree-sitter.
	 * This clears any pending offset since we now have accurate data.
	 */
	const setHighlights = (path: string, highlights?: TreeSitterCapture[]) => {
		if (!path) return

		// Clear pending offset - we have real data now
		setHighlightOffsets(path, undefined)

		if (!highlights?.length) {
			setHighlightsStore(path, undefined)
			return
		}

		setHighlightsStore(path, highlights)
	}

	const clearHighlights = () => {
		setHighlightsStore(reconcile({}))
		setHighlightOffsets(reconcile({}))
	}

	return {
		fileHighlights,
		highlightOffsets,
		setHighlights,
		applyHighlightOffset,
		clearHighlights,
	}
}
