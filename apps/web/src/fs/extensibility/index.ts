/**
 * View Mode Extensibility Infrastructure
 * 
 * This module provides the complete extensibility infrastructure for view modes,
 * enabling consistent behavior patterns and easy addition of new view modes.
 * 
 * Requirements: 7.1, 7.3, 7.4, 7.5
 */

// Registry and core types
export { 
	ViewModeRegistry, 
	viewModeRegistry,
	type ViewModeDefinition 
} from '../registry/ViewModeRegistry'

// Hooks for view mode management
export { useViewModeManager } from '../hooks/useViewModeManager'
export { useViewModeState } from '../hooks/useViewModeState'
export { useViewModeBehavior } from '../hooks/useViewModeBehavior'

// Utility functions
export {
	detectAvailableViewModes,
	getDefaultViewMode,
	getValidViewMode,
	isViewModeValid,
	getViewModeLabel,
	supportsMultipleViewModes,
	isRegularFile
} from '../utils/viewModeDetection'

// Core types
export type { ViewMode } from '../types/ViewMode'

/**
 * Example usage for extending with new view modes:
 * 
 * ```typescript
 * import { viewModeRegistry } from './extensibility'
 * 
 * // Register a new view mode
 * viewModeRegistry.register({
 *   id: 'preview',
 *   label: 'Preview',
 *   icon: 'eye',
 *   isAvailable: (path) => path.endsWith('.md'),
 *   stateHooks: {
 *     createState: () => ({ scrollPosition: 0 }),
 *     cleanup: (state) => { console.log('cleanup', state) }
 *   }
 * })
 * ```
 */