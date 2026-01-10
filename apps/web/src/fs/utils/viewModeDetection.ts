import type { ParseResult } from '@repo/utils'
import type { ViewMode } from '../types/ViewMode'
import { viewModeRegistry } from '../registry/ViewModeRegistry'

/**
 * Detects all available view modes for a given file
 */
export const detectAvailableViewModes = (
	path: string,
	stats?: ParseResult
): ViewMode[] => {
	// Ensure registry is initialized
	viewModeRegistry.initialize()
	
	const availableModes = viewModeRegistry.getAvailableModes(path, stats)
	return availableModes.map((mode) => mode.id)
}

/**
 * Gets the default view mode for a file
 */
export const getDefaultViewMode = (
	path: string,
	stats?: ParseResult
): ViewMode => {
	// Ensure registry is initialized
	viewModeRegistry.initialize()
	
	return viewModeRegistry.getDefaultMode(path, stats)
}

/**
 * Checks if a file supports multiple view modes
 */
export const supportsMultipleViewModes = (
	path: string,
	stats?: ParseResult
): boolean => {
	// Ensure registry is initialized
	viewModeRegistry.initialize()
	
	const availableModes = detectAvailableViewModes(path, stats)
	return availableModes.length > 1
}

/**
 * Validates if a view mode is available for a specific file
 */
export const isViewModeValid = (
	viewMode: ViewMode,
	path: string,
	stats?: ParseResult
): boolean => {
	// Ensure registry is initialized
	viewModeRegistry.initialize()
	
	return viewModeRegistry.isViewModeAvailable(viewMode, path, stats)
}

/**
 * Gets the display label for a view mode
 */
export const getViewModeLabel = (viewMode: ViewMode): string => {
	// Ensure registry is initialized
	viewModeRegistry.initialize()
	
	const mode = viewModeRegistry.getViewMode(viewMode)
	return mode?.label ?? viewMode
}

/**
 * Safely gets a valid view mode for a file, with fallback to default
 * Handles error cases where requested view mode is unavailable
 */
export const getValidViewMode = (
	requestedMode: ViewMode,
	path: string,
	stats?: ParseResult
): ViewMode => {
	// Check if the requested mode is available
	if (isViewModeValid(requestedMode, path, stats)) {
		return requestedMode
	}
	
	// Fallback to default mode if requested mode is unavailable
	return getDefaultViewMode(path, stats)
}

/**
 * Ensures regular files maintain existing behavior (Requirements 6.1, 6.3, 6.4)
 * Returns true if file should only support editor mode
 */
export const isRegularFile = (path: string, stats?: ParseResult): boolean => {
	// Ensure registry is initialized
	viewModeRegistry.initialize()
	
	const availableModes = detectAvailableViewModes(path, stats)
	return availableModes.length === 1 && availableModes[0] === 'editor'
}
