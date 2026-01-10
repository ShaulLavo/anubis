import { createMemo } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { ParseResult } from '@repo/utils'
import type { ViewMode } from '../types/ViewMode'
import { viewModeRegistry } from '../registry/ViewModeRegistry'
import { 
	detectAvailableViewModes, 
	getDefaultViewMode, 
	getValidViewMode,
	isViewModeValid,
	getViewModeLabel
} from '../utils/viewModeDetection'

/**
 * Hook for managing view modes with consistent behavior patterns
 * Requirements: 7.4, 7.5 - Consistent behavior patterns across all view modes
 */
export const useViewModeManager = (
	path: Accessor<string | undefined>,
	stats: Accessor<ParseResult | undefined> = () => undefined
) => {
	/**
	 * Get all available view modes for the current file
	 */
	const availableViewModes = createMemo(() => {
		const currentPath = path()
		if (!currentPath) return []
		
		return detectAvailableViewModes(currentPath, stats())
	})

	/**
	 * Get the default view mode for the current file
	 */
	const defaultViewMode = createMemo(() => {
		const currentPath = path()
		if (!currentPath) return 'editor' as ViewMode
		
		return getDefaultViewMode(currentPath, stats())
	})

	/**
	 * Check if the current file supports multiple view modes
	 */
	const supportsMultipleViewModes = createMemo(() => {
		return availableViewModes().length > 1
	})

	/**
	 * Validate and get a safe view mode for the current file
	 */
	const getValidatedViewMode = (requestedMode: ViewMode): ViewMode => {
		const currentPath = path()
		if (!currentPath) return 'editor'
		
		return getValidViewMode(requestedMode, currentPath, stats())
	}

	/**
	 * Check if a specific view mode is valid for the current file
	 */
	const isValidViewMode = (viewMode: ViewMode): boolean => {
		const currentPath = path()
		if (!currentPath) return viewMode === 'editor'
		
		return isViewModeValid(viewMode, currentPath, stats())
	}

	/**
	 * Get display information for available view modes
	 */
	const getViewModeOptions = createMemo(() => {
		return availableViewModes().map(mode => ({
			id: mode,
			label: getViewModeLabel(mode),
			definition: viewModeRegistry.getViewMode(mode)
		}))
	})

	/**
	 * Get view mode definition for a specific mode
	 */
	const getViewModeDefinition = (viewMode: ViewMode) => {
		return viewModeRegistry.getViewMode(viewMode)
	}

	return {
		availableViewModes,
		defaultViewMode,
		supportsMultipleViewModes,
		getValidatedViewMode,
		isValidViewMode,
		getViewModeOptions,
		getViewModeDefinition,
	}
}