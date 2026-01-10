import { createMemo, onCleanup, onMount, ParentComponent } from 'solid-js'
import { Accordion, AccordionItem, AccordionContent } from '@repo/ui/accordion'
import * as AccordionPrimitive from '@kobalte/core/accordion'
import { VsChevronDown } from '@repo/icons/vs/VsChevronDown'
import { Flex } from '@repo/ui/flex'
import { useFocusManager } from '~/focus/focusManager'
import { useFs } from '../context/FsContext'
import { FsToolbar } from './FsToolbar'
import { SystemFilesSection } from './SystemFilesSection'

export const ExplorerAccordion: ParentComponent = (props) => {
	const focus = useFocusManager()
	const [state] = useFs()
	let containerRef: HTMLDivElement = null!

	onMount(() => {
		if (!containerRef) return
		const unregister = focus.registerArea('fileTree', () => containerRef)
		onCleanup(unregister)
	})

	const parentPath = createMemo(() => {
		const selected = state.selectedPath
		if (!selected) return ''

		const node = state.selectedNode
		if (!node) return ''

		if (node.kind === 'dir') {
			return node.path
		}
		const lastSlash = selected.lastIndexOf('/')
		return lastSlash > 0 ? selected.slice(0, lastSlash) : ''
	})

	return (
		<Flex
			ref={containerRef}
			flexDirection="col"
			alignItems="stretch"
			class="h-full overflow-hidden"
		>
			<Accordion
				multiple
				defaultValue={['system', 'explorer']}
				class="flex flex-col h-full overflow-hidden"
			>
				{/* System Section */}
				<AccordionItem
					value="system"
					class="shrink-0 flex flex-col max-h-[30%] border-b border-border/50"
				>
					<AccordionPrimitive.Header class="flex items-center w-full shrink-0 bg-background">
						<AccordionPrimitive.Trigger class="flex w-full items-center gap-1 py-1 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground focus:outline-none [&:not([data-expanded])>svg]:-rotate-90">
							<VsChevronDown
								size={16}
								class="shrink-0 transition-transform duration-200"
							/>
							System
						</AccordionPrimitive.Trigger>
					</AccordionPrimitive.Header>
					<AccordionContent class="min-h-0 flex-1">
						<div class="overflow-auto max-h-full">
							<SystemFilesSection />
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Explorer Section */}
				<AccordionItem value="explorer" class="flex-1 min-h-0 flex flex-col">
					<Flex
						alignItems="center"
						class="w-full shrink-0 bg-background border-b border-border/50"
					>
						<AccordionPrimitive.Header class="flex-1">
							<AccordionPrimitive.Trigger class="flex w-full items-center gap-1 py-1 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground focus:outline-none [&:not([data-expanded])>svg]:-rotate-90">
								<VsChevronDown
									size={16}
									class="shrink-0 transition-transform duration-200"
								/>
								Explorer
							</AccordionPrimitive.Trigger>
						</AccordionPrimitive.Header>
						<FsToolbar parentPath={parentPath} />
					</Flex>
					<AccordionContent class="flex-1 min-h-0">
						{props.children}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</Flex>
	)
}
