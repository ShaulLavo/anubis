import { createContext, useContext, onMount, onCleanup, type ParentComponent } from 'solid-js'
import { createCommandPaletteRegistry } from './registry'
import { useCommandPalette } from './useCommandPalette'
import { registerBuiltinCommands } from './builtinCommands'
import { registerCommandPaletteShortcuts } from './shortcuts'
import { useKeymap } from '../keymap/KeymapContext'
import type { CommandPaletteRegistry } from './types'
import type { PaletteState, PaletteActions } from './useCommandPalette'

interface CommandPaletteContextValue {
	registry: CommandPaletteRegistry
	state: () => PaletteState
	actions: PaletteActions
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>()

export function useCommandPaletteContext(): CommandPaletteContextValue {
	const context = useContext(CommandPaletteContext)
	if (!context) {
		throw new Error('useCommandPaletteContext must be used within a CommandPaletteProvider')
	}
	return context
}

export const CommandPaletteProvider: ParentComponent = (props) => {
	// Create registry instance
	const registry = createCommandPaletteRegistry()
	
	// Create palette state and actions
	const [state, actions] = useCommandPalette()
	
	// Get keymap controller for registering shortcuts
	const keymapController = useKeymap()
	
	// Initialize built-in commands and shortcuts on mount
	onMount(() => {
		// Register built-in commands
		const unregisterBuiltinCommands = registerBuiltinCommands(registry)
		
		// Register keyboard shortcuts
		const unregisterShortcuts = registerCommandPaletteShortcuts(
			keymapController,
			actions,
			() => state().isOpen
		)
		
		// Cleanup on unmount
		onCleanup(() => {
			unregisterBuiltinCommands()
			unregisterShortcuts()
		})
	})
	
	const contextValue: CommandPaletteContextValue = {
		registry,
		state,
		actions
	}
	
	return (
		<CommandPaletteContext.Provider value={contextValue}>
			{props.children}
		</CommandPaletteContext.Provider>
	)
}