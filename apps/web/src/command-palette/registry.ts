import type { CommandDescriptor, CommandPaletteRegistry } from './types'

class CommandPaletteRegistryImpl implements CommandPaletteRegistry {
	private commands = new Map<string, CommandDescriptor>()

	register(command: CommandDescriptor): () => void {
		if (this.commands.has(command.id)) {
			throw new Error(`Command with id "${command.id}" is already registered`)
		}

		this.commands.set(command.id, command)

		// Return unregister function
		return () => {
			this.unregister(command.id)
		}
	}

	unregister(id: string): void {
		this.commands.delete(id)
	}

	getAll(): CommandDescriptor[] {
		return Array.from(this.commands.values())
	}

	search(query: string): CommandDescriptor[] {
		if (!query.trim()) {
			return this.getAll()
		}

		const lowerQuery = query.toLowerCase()
		return this.getAll().filter(command => 
			command.label.toLowerCase().includes(lowerQuery) ||
			command.category.toLowerCase().includes(lowerQuery)
		)
	}

	async execute(id: string): Promise<void> {
		const command = this.commands.get(id)
		if (!command) {
			console.warn(`Command not found: ${id}`)
			return
		}

		// Check conditional availability
		if (command.when && !command.when()) {
			console.warn(`Command "${id}" is not available in current context`)
			return
		}

		try {
			await command.handler()
		} catch (error) {
			console.error(`Command failed: ${id}`, error)
			throw error
		}
	}
}

// Singleton instance
let registryInstance: CommandPaletteRegistry | null = null

export function createCommandPaletteRegistry(): CommandPaletteRegistry {
	if (!registryInstance) {
		registryInstance = new CommandPaletteRegistryImpl()
	}
	return registryInstance
}

export function getCommandPaletteRegistry(): CommandPaletteRegistry {
	if (!registryInstance) {
		throw new Error('CommandPaletteRegistry not initialized. Call createCommandPaletteRegistry() first.')
	}
	return registryInstance
}

// For testing purposes - allows resetting the singleton
export function resetCommandPaletteRegistry(): void {
	registryInstance = null
}