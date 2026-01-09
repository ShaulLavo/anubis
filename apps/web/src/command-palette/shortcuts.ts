import type { KeymapController } from '../keymap/KeymapContext'
import type { PaletteActions } from './useCommandPalette'

/**
 * Registers command palette keyboard shortcuts with the KeymapController
 * 
 * Shortcuts:
 * - Cmd/Ctrl+P: Open palette in file mode
 * - Cmd/Ctrl+K: Open palette in file mode  
 * - Cmd/Ctrl+Shift+P: Open palette in command mode
 * - Escape: Close palette (when open)
 */
export function registerCommandPaletteShortcuts(
	controller: KeymapController,
	actions: PaletteActions,
	isOpen: () => boolean
) {
	// Register keybindings for palette shortcuts
	const cmdPBinding = controller.registerKeybinding({
		shortcut: 'meta+p',
		id: 'command-palette.open-file-mode-meta-p',
		options: {
			preventDefault: true,
		}
	})

	const ctrlPBinding = controller.registerKeybinding({
		shortcut: 'ctrl+p',
		id: 'command-palette.open-file-mode-ctrl-p',
		options: {
			preventDefault: true,
		}
	})

	const cmdKBinding = controller.registerKeybinding({
		shortcut: 'meta+k',
		id: 'command-palette.open-file-mode-meta-k',
		options: {
			preventDefault: true,
		}
	})

	const ctrlKBinding = controller.registerKeybinding({
		shortcut: 'ctrl+k',
		id: 'command-palette.open-file-mode-ctrl-k',
		options: {
			preventDefault: true,
		}
	})

	const cmdShiftPBinding = controller.registerKeybinding({
		shortcut: 'meta+shift+p',
		id: 'command-palette.open-command-mode-meta-shift-p',
		options: {
			preventDefault: true,
		}
	})

	const ctrlShiftPBinding = controller.registerKeybinding({
		shortcut: 'ctrl+shift+p',
		id: 'command-palette.open-command-mode-ctrl-shift-p',
		options: {
			preventDefault: true,
		}
	})

	const escapeBinding = controller.registerKeybinding({
		shortcut: 'escape',
		id: 'command-palette.close',
		options: {
			preventDefault: false, // Don't prevent default for escape - let other handlers run too
		}
	})

	// Register commands for opening palette in file mode
	const openFileModeCommand = controller.registerCommand({
		id: 'command-palette.open-file-mode',
		run: () => {
			if (isOpen()) {
				actions.close()
			} else {
				actions.open('file')
			}
		},
	})

	// Register command for opening palette in command mode
	const openCommandModeCommand = controller.registerCommand({
		id: 'command-palette.open-command-mode',
		run: () => {
			if (isOpen()) {
				actions.close()
			} else {
				actions.open('command')
			}
		},
	})

	// Register command for closing palette
	const closePaletteCommand = controller.registerCommand({
		id: 'command-palette.close',
		run: () => {
			if (isOpen()) {
				actions.close()
			}
		},
	})

	// Bind commands to keybindings in global scope
	const cmdPCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.open-file-mode-meta-p',
		commandId: 'command-palette.open-file-mode',
	})

	const ctrlPCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.open-file-mode-ctrl-p',
		commandId: 'command-palette.open-file-mode',
	})

	const cmdKCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.open-file-mode-meta-k',
		commandId: 'command-palette.open-file-mode',
	})

	const ctrlKCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.open-file-mode-ctrl-k',
		commandId: 'command-palette.open-file-mode',
	})

	const cmdShiftPCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.open-command-mode-meta-shift-p',
		commandId: 'command-palette.open-command-mode',
	})

	const ctrlShiftPCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.open-command-mode-ctrl-shift-p',
		commandId: 'command-palette.open-command-mode',
	})

	const escapeCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'command-palette.close',
		commandId: 'command-palette.close',
	})

	// Return cleanup function to unregister all shortcuts
	return () => {
		// Dispose command bindings
		cmdPCommandBinding()
		ctrlPCommandBinding()
		cmdKCommandBinding()
		ctrlKCommandBinding()
		cmdShiftPCommandBinding()
		ctrlShiftPCommandBinding()
		escapeCommandBinding()

		// Dispose commands
		openFileModeCommand()
		openCommandModeCommand()
		closePaletteCommand()

		// Dispose keybindings
		cmdPBinding.dispose()
		ctrlPBinding.dispose()
		cmdKBinding.dispose()
		ctrlKBinding.dispose()
		cmdShiftPBinding.dispose()
		ctrlShiftPBinding.dispose()
		escapeBinding.dispose()
	}
}