/**
 * Split Editor Module
 *
 * Recursive split editor system with Layout Manager, Resource Manager, and UI components.
 */

export * from './types'
export { createLayoutManager, type LayoutManager } from './createLayoutManager'
export {
	createResourceManager,
	type ResourceManager,
	type SharedBuffer,
	type HighlightState,
	type TextEdit,
} from './createResourceManager'
