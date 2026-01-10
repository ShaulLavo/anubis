// Re-export view mode types and legacy migration utilities
export type { ViewMode } from './ViewMode'
export { cleanLegacyTabId, migrateTabState } from './ViewMode'

// Re-export view mode registry
export type { ViewModeDefinition } from '../registry/ViewModeRegistry'
export {
	ViewModeRegistry,
	viewModeRegistry,
} from '../registry/ViewModeRegistry'

// Re-export view mode detection utilities
export {
	detectAvailableViewModes,
	getDefaultViewMode,
	supportsMultipleViewModes,
	isViewModeValid,
	getViewModeLabel,
	getValidViewMode,
	isRegularFile,
} from '../utils/viewModeDetection'
