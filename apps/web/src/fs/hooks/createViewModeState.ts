import { createStore } from 'solid-js/store'
import { ReactiveSet } from '@solid-primitives/set'
import type { ParseResult } from '@repo/utils'
import type { ViewMode } from '../types/ViewMode'
import { getDefaultViewMode } from '../utils/viewModeDetection'

/**
 * Normalize path by stripping leading slash.
 * Cache keys use normalized paths (without leading slash).
 */
const normalizePath = (path: string): string =>
	path.startsWith('/') ? path.slice(1) : path

export const createViewModeState = () => {
	// Store only non-default view modes
	const [fileViewModes, setFileViewModes] = createStore<
		Record<string, ViewMode>
	>({})
	// Track which paths have custom view modes for efficient cleanup
	const pathsWithCustomModes = new ReactiveSet<string>()

	const setViewMode = (
		path: string,
		viewMode: ViewMode,
		stats?: ParseResult
	) => {
		const p = normalizePath(path)
		const defaultMode = getDefaultViewMode(p, stats)

		if (viewMode === defaultMode) {
			setFileViewModes(p, undefined!)
			pathsWithCustomModes.delete(p)
		} else {
			setFileViewModes(p, viewMode)
			pathsWithCustomModes.add(p)
		}
	}

	const getViewMode = (path: string, stats?: ParseResult): ViewMode => {
		const p = normalizePath(path)
		const stored = fileViewModes[p]
		if (stored) {
			return stored
		}

		const defaultMode = getDefaultViewMode(p, stats)
		return defaultMode
	}

	const clearViewModes = () => {
		setFileViewModes({})
		pathsWithCustomModes.clear()
	}

	return {
		fileViewModes,
		pathsWithCustomModes,
		setViewMode,
		getViewMode,
		clearViewModes,
	}
}
