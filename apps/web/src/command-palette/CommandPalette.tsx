import { Dialog } from '@kobalte/core/dialog'
import { For, Show, createEffect } from 'solid-js'
import { useCommandPalette } from './useCommandPalette'
import type { PaletteResult } from './useCommandPalette'

interface ResultItemProps {
	result: PaletteResult
	isSelected: boolean
	resultIndex: number
	onClick: () => void
}

function ResultItem(props: ResultItemProps) {
	return (
		<div
			id={`result-${props.resultIndex}`}
			role="option"
			aria-selected={props.isSelected}
			class={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
				props.isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
			}`}
			onClick={props.onClick}
		>
			<div class="flex-1 min-w-0">
				<div class="font-medium text-gray-900 dark:text-gray-100">
					{props.result.label}
				</div>
				<Show when={props.result.description}>
					<div class="text-gray-500 dark:text-gray-400 truncate">
						{props.result.kind === 'file' ? props.result.description : `${props.result.description}`}
					</div>
				</Show>
			</div>
			<Show when={props.result.shortcut}>
				<div class="ml-2 text-xs text-gray-400 dark:text-gray-500">
					{props.result.shortcut}
				</div>
			</Show>
		</div>
	)
}

export function CommandPalette() {
	const [state, actions] = useCommandPalette()
	let inputRef: HTMLInputElement | undefined

	// Handle keyboard navigation
	const handleKeyDown = (e: KeyboardEvent) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				actions.selectNext()
				break
			case 'ArrowUp':
				e.preventDefault()
				actions.selectPrevious()
				break
			case 'Enter':
				e.preventDefault()
				actions.activateSelected()
				break
			case 'Escape':
				e.preventDefault()
				actions.close()
				break
		}
	}

	// Focus input when palette opens
	createEffect(() => {
		if (state().isOpen && inputRef) {
			inputRef.focus()
		}
	})

	return (
		<Dialog open={state().isOpen} onOpenChange={(open) => {
			if (!open) {
				actions.close()
			}
		}}>
			<Dialog.Portal>
				<Dialog.Overlay 
					class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" 
					onClick={() => actions.close()} 
				/>
				<Dialog.Content 
					class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 transform rounded-lg border border-gray-200 bg-white p-0 shadow-lg dark:border-gray-700 dark:bg-gray-800"
					aria-label="Command Palette"
				>
					{/* Search Input */}
					<div class="border-b border-gray-200 p-4 dark:border-gray-700">
						<input
							ref={inputRef}
							type="text"
							placeholder={state().mode === 'command' ? 'Type a command...' : 'Search files...'}
							value={state().query}
							onInput={(e) => actions.setQuery(e.currentTarget.value)}
							onKeyDown={handleKeyDown}
							class="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
							aria-label={state().mode === 'command' ? 'Search commands' : 'Search files'}
							aria-expanded={state().results.length > 0}
							aria-activedescendant={state().results.length > 0 ? `result-${state().selectedIndex}` : undefined}
							role="combobox"
							aria-autocomplete="list"
							autofocus
						/>
					</div>
					
					{/* Results List */}
					<div class="max-h-96 overflow-y-auto" role="listbox" aria-label="Search results">
						<Show
							when={!state().loading}
							fallback={
								<div class="p-4 text-center">
									<div class="flex items-center justify-center space-x-2">
										<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
										<p class="text-sm text-gray-500">Searching...</p>
									</div>
								</div>
							}
						>
							<Show
								when={state().results.length > 0}
								fallback={
									<div class="p-4 text-center">
										<p class="text-sm text-gray-500">No results found</p>
									</div>
								}
							>
								<For each={state().results}>
									{(result, index) => (
										<ResultItem
											result={result}
											isSelected={index() === state().selectedIndex}
											resultIndex={index()}
											onClick={() => {
												// For click handling, we need to simulate selecting the clicked item
												// and then activating it. Since we don't have a direct setSelectedIndex action,
												// we'll need to work with the current selection logic.
												
												// Find the clicked result and activate it directly
												const currentResults = state().results
												const clickedResult = currentResults[index()]
												
												if (clickedResult) {
													if (clickedResult.kind === 'file') {
														console.log('File selected:', clickedResult.description)
														actions.close()
													} else if (clickedResult.kind === 'command') {
														const commandId = clickedResult.id.replace('cmd:', '')
														// We'll need to access the registry directly for click handling
														// This is a temporary solution until we have better click integration
														actions.close()
													}
												}
											}}
										/>
									)}
								</For>
							</Show>
						</Show>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	)
}