/**
 * View mode types for files
 * View modes are stored separately - tabs are just file paths
 * 
 * Built-in view modes with extensibility support
 */
export type BuiltInViewMode = 'editor' | 'ui' | 'binary'

/**
 * Extensible view mode type that allows custom modes
 * Built-in modes are strongly typed, custom modes are strings
 */
export type ViewMode = BuiltInViewMode | (string & {})

/**
 * Legacy migration utilities - still needed for existing users
 */

/**
 * Cleans up legacy tab IDs that had :viewMode suffix
 * Now tabs are just file paths
 */
export const cleanLegacyTabId = (tabId: string): string => {
	// Remove any :editor, :ui, :binary suffix from old tab format
	if (tabId.includes(':')) {
		const colonIndex = tabId.lastIndexOf(':')
		const suffix = tabId.slice(colonIndex + 1)
		if (suffix === 'editor' || suffix === 'ui' || suffix === 'binary') {
			return tabId.slice(0, colonIndex)
		}
	}
	return tabId
}

/**
 * Migrates existing tab state to remove view mode suffixes
 * Tabs are now just file paths
 */
export const migrateTabState = (oldTabs: string[]): string[] => {
	const cleaned = oldTabs.map(cleanLegacyTabId)
	// Remove duplicates that might result from migration
	return [...new Set(cleaned)]
}

/**
 * Type guard to check if a view mode is a built-in mode
 */
export const isBuiltInViewMode = (mode: ViewMode): mode is BuiltInViewMode => {
	return mode === 'editor' || mode === 'ui' || mode === 'binary'
}
