import { For, Show, onMount, createSignal } from 'solid-js'
import { TextField, TextFieldInput } from '@repo/ui/text-field'
import { Button } from '@repo/ui/button'
import { Flex } from '@repo/ui/flex'
import { createFixedRowVirtualizer } from '@repo/code-editor'
import type { SearchResult } from '../../search/types'

type Props = {
	searchQuery: () => string
	setSearchQuery: (q: string) => void
	onSearch: () => void
	results: () => SearchResult[] | null
	isLoading: () => boolean
}

export const SearchFiles = (props: Props) => {
	const [scrollElement, setScrollElement] = createSignal<HTMLElement | null>(
		null
	)

	onMount(() => {
		if (!props.results() && !props.isLoading()) {
			props.onSearch()
		}
	})

	const virtualizer = createFixedRowVirtualizer({
		count: () => props.results()?.length ?? 0,
		scrollElement: scrollElement,
		rowHeight: () => 48,
		overscan: 5,
		enabled: () => true,
	})

	return (
		<Flex
			flexDirection="col"
			alignItems="stretch"
			class="flex-1 gap-4 p-4 border-b border-border bg-card overflow-hidden"
		>
			<Flex justifyContent="start" class="gap-2">
				<TextField
					value={props.searchQuery()}
					onChange={(v) => {
						props.setSearchQuery(v)
						props.onSearch()
					}}
					class="flex-1"
				>
					<TextFieldInput placeholder="Search files (fuzzy)..." />
				</TextField>
			</Flex>

			<Flex justifyContent="start" class="gap-2 text-muted-foreground">
				<span class="text-xs">Examples:</span>
				<div class="flex gap-1">
					<For each={['utils', '.tsx', 'schema', 'test']}>
						{(term) => (
							<Button
								onClick={() => {
									props.setSearchQuery(term)
									props.onSearch()
								}}
								variant="secondary"
								class="h-auto text-xs px-2 py-0.5 border border-input"
							>
								{term}
							</Button>
						)}
					</For>
				</div>
			</Flex>

			<Show
				when={props.results()}
				fallback={
					<Flex
						justifyContent="center"
						class="h-32 text-muted-foreground text-sm animate-pulse"
					>
						Loading data...
					</Flex>
				}
			>
				<Flex
					flexDirection="col"
					alignItems="stretch"
					class="gap-2 flex-1 min-h-0"
				>
					<Flex
						justifyContent="between"
						class="text-xs font-mono text-muted-foreground uppercase tracking-wider min-h-[20px] shrink-0"
					>
						<span>Found {props.results()?.length} results</span>
						<Show when={props.isLoading()}>
							<span class="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground animate-pulse border border-input">
								Updating...
							</span>
						</Show>
					</Flex>

					<div
						ref={setScrollElement}
						class="flex-1 overflow-y-auto min-h-0 w-full"
					>
						<div
							style={{
								height: `${virtualizer.totalSize()}px`,
								width: '100%',
								position: 'relative',
							}}
						>
							<For each={virtualizer.virtualItems()}>
								{(virtualRow) => {
									const file = props.results()![virtualRow.index]
									if (!file) return null
									return (
										<div
											style={{
												position: 'absolute',
												top: 0,
												left: 0,
												width: '100%',
												height: `${virtualRow.size}px`,
												transform: `translateY(${virtualRow.start}px)`,
											}}
											class="px-2"
										>
											<Flex
												justifyContent="between"
												class="px-2 py-1 rounded hover:bg-muted/50 group h-full cursor-pointer transition-colors"
											>
												<Flex
													flexDirection="col"
													alignItems="start"
													class="gap-0.5 min-w-0 flex-1 w-auto"
												>
													<span class="text-sm text-foreground truncate font-mono">
														{file.path.split('/').pop()}
													</span>
													<span class="text-xs text-muted-foreground truncate font-mono">
														{file.path}
													</span>
												</Flex>
												<Flex
													justifyContent="start"
													class="gap-2 shrink-0 w-auto"
												>
													<span class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-input">
														{file.kind}
													</span>
													<span class="text-[10px] text-muted-foreground font-mono">
														#{file.id}
													</span>
												</Flex>
											</Flex>
										</div>
									)
								}}
							</For>
						</div>
					</div>

					<Show when={props.results()?.length === 0}>
						<div class="text-muted-foreground text-sm italic py-2">
							No files found matching "{props.searchQuery()}"
						</div>
					</Show>
				</Flex>
			</Show>
		</Flex>
	)
}
