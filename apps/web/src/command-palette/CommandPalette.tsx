import { Dialog } from '@kobalte/core/dialog'
import { For, Show, createEffect, createSignal } from 'solid-js'
import { useCommandPaletteContext } from './CommandPaletteProvider'
import type { PaletteResult } from './useCommandPalette'

interface ResultItemProps {
	result: PaletteResult
	isSelected: boolean
	resultIndex: number
	onClick: () => void
	onMouseEnter?: () => void
	onMouseMove?: () => void
	isUsingKeyboard: boolean
}

function ResultItem(props: ResultItemProps) {
	return (
		<div
			id={`result-${props.resultIndex}`}
			role="option"
			aria-selected={props.isSelected}
			class={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
				props.isUsingKeyboard ? '' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
			} ${
				props.isSelected ? 'bg-gray-100 dark:bg-gray-700' : ''
			}`}
			onClick={props.onClick}
			onMouseEnter={() => {
				// Update keyboard selection to match mouse hover
				props.onMouseEnter?.()
			}}
			onMouseMove={() => {
				// Reset keyboard mode on mouse movement
				props.onMouseMove?.()
			}}
		>
			<div class="flex-1 min-w-0 flex items-center space-x-2">
				<Show 
					when={props.result.kind === 'file'}
					fallback={
						<>
							<span class="font-medium text-gray-900 dark:text-gray-100">
								{props.result.label}
							</span>
							<Show when={props.result.description}>
								<span class="text-gray-500 dark:text-gray-400">
									{props.result.description}
								</span>
							</Show>
						</>
					}
				>
					<span class="font-medium text-gray-900 dark:text-gray-100">
						{props.result.label}
					</span>
					<Show when={props.result.description}>
						<span class="text-gray-500 dark:text-gray-400 truncate">
							{props.result.description}
						</span>
					</Show>
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
	const { state, actions } = useCommandPaletteContext()
	let inputRef: HTMLInputElement | undefined
	let resultsContainerRef: HTMLDivElement | undefined
	const [isUsingKeyboard, setIsUsingKeyboard] = createSignal(false)

	// Scroll selected item into view
	const scrollToSelected = () => {
		if (!resultsContainerRef) return
		
		const selectedElement = resultsContainerRef.querySelector(`#result-${state().selectedIndex}`)
		if (selectedElement) {
			selectedElement.scrollIntoView({
				behavior: 'auto',
				block: 'nearest'
			})
		}
	}

	// Handle keyboard navigation
	const handleKeyDown = (e: KeyboardEvent) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				setIsUsingKeyboard(true)
				actions.selectNext()
				// Scroll after state update
				setTimeout(scrollToSelected, 0)
				break
			case 'ArrowUp':
				e.preventDefault()
				setIsUsingKeyboard(true)
				actions.selectPrevious()
				// Scroll after state update
				setTimeout(scrollToSelected, 0)
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
					class="fixed inset-0 z-50" 
					style="backdrop-filter: blur(1px);"
					onClick={() => actions.close()} 
				/>
				<Dialog.Content 
					class="fixed left-1/2 top-[30%] z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
					aria-label="Command Palette"
				>
					{/* Search Input */}
					<div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
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
					<div 
						ref={resultsContainerRef}
						class="max-h-80 overflow-y-auto" 
						role="listbox" 
						aria-label="Search results"
					>
						<Show
							when={!state().loading}
							fallback={
								<div class="px-3 py-8 text-center">
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
									<div class="px-3 py-8 text-center">
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
												// Set the selected index to the clicked item and then activate it
												actions.setSelectedIndex(index())
												actions.activateSelected()
											}}
											onMouseEnter={() => {
												// Only update selection if not using keyboard
												if (!isUsingKeyboard()) {
													actions.setSelectedIndex(index())
												}
											}}
											onMouseMove={() => {
												// Reset keyboard mode on mouse movement
												setIsUsingKeyboard(false)
											}}
											isUsingKeyboard={isUsingKeyboard()}
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