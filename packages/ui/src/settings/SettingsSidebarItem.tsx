import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import * as Accordion from '@corvu/accordion'
import { VsChevronRight } from '@repo/icons/vs/VsChevronRight'
import { cn } from '../utils'

export type SettingsCategory = {
	id: string
	label: string
	subcategories?: SettingsCategory[]
}

export type SettingsSidebarItemProps = {
	category: SettingsCategory
	level?: number
	selectedCategory: string
	onCategorySelect: (categoryId: string) => void
}

export const SettingsSidebarItem: Component<SettingsSidebarItemProps> = (props) => {
	const level = () => props.level ?? 0
	const isSelected = () => props.selectedCategory === props.category.id
	const hasSubcategories = () => Boolean(props.category.subcategories?.length)

	const itemClass = () => cn(
		'group flex w-full items-center justify-between gap-2 text-left text-sm',
		'py-1 pr-2.5',
		'border-l-2 border-transparent',
		'transition-colors',
		'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
		isSelected() && 'border-foreground/40 bg-muted/60 text-foreground font-semibold',
		level() > 0 ? 'pl-5' : 'pl-2.5'
	)

	return (
		<Show
			when={hasSubcategories()}
			fallback={
				<button
					type="button"
					onClick={() => props.onCategorySelect(props.category.id)}
					class={itemClass()}
				>
					<span class="truncate">{props.category.label}</span>
				</button>
			}
		>
			<Accordion.Root multiple={true}>
				<Accordion.Item value={props.category.id}>
					<Accordion.Trigger
						class={cn(
							itemClass(),
							'[&[data-expanded]>svg]:rotate-90'
						)}
						onClick={() => props.onCategorySelect(props.category.id)}
					>
						<span class="truncate">{props.category.label}</span>
						<VsChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" />
					</Accordion.Trigger>
					<Accordion.Content class="overflow-hidden data-[expanded]:animate-accordion-down data-[closed]:animate-accordion-up">
						<div class="space-y-1 pt-1">
							<For each={props.category.subcategories || []}>
								{(subcategory) => (
									<SettingsSidebarItem
										category={subcategory}
										level={level() + 1}
										selectedCategory={props.selectedCategory}
										onCategorySelect={props.onCategorySelect}
									/>
								)}
							</For>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</Show>
	)
}
