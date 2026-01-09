import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { SettingItem } from './SettingItem'
import type { SettingDefinition } from './SettingItem'
import { SettingsScrollArea } from './SettingsScrollArea'
import { cn } from '../utils'

export type SettingsPanelProps = {
	categoryId: string
	categoryLabel?: string
	settings: SettingDefinition[]
	values: Record<string, unknown>
	onSettingChange: (key: string, value: unknown) => void
	class?: string
	/** Parent category ID when a subcategory is selected */
	parentCategoryId?: string
}

export const SettingsPanel: Component<SettingsPanelProps> = (props) => {
	// Filter settings for the current category or subcategory
	const categorySettings = () =>
		props.settings.filter((setting) => {
			// If we have a parent category, we're viewing a subcategory
			if (props.parentCategoryId) {
				return (
					setting.category === props.parentCategoryId &&
					setting.subcategory === props.categoryId
				)
			}
			// Otherwise, show all settings for this category
			return setting.category === props.categoryId
		})

	// Group settings by subcategory
	const groupedSettings = () => {
		const settings = categorySettings()
		const groups: Record<string, SettingDefinition[]> = {}

		settings.forEach((setting) => {
			const subcategory = setting.subcategory || 'general'
			if (!groups[subcategory]) {
				groups[subcategory] = []
			}
			groups[subcategory].push(setting)
		})

		return groups
	}

	const groupedEntries = () => Object.entries(groupedSettings())
	const shouldShowSubcategory = (subcategory: string) =>
		subcategory !== 'general' || groupedEntries().length > 1

	return (
		<SettingsScrollArea
			class={cn('h-full min-h-0 bg-background', props.class)}
			contentClass="px-4 py-3 pr-6"
		>
			{/* Category header */}
			<Show when={props.categoryLabel}>
				<div class="mb-3 border border-border/60 bg-muted/40 px-3 py-1.5">
					<h1 class="text-xl font-semibold text-foreground">
						{props.categoryLabel}
					</h1>
				</div>
			</Show>

			{/* Settings grouped by subcategory */}
			<div class="space-y-5">
				<For each={groupedEntries()}>
					{([subcategory, settings]) => (
						<div class="space-y-3">
							{/* Subcategory header (only show if not 'general' or if there are multiple subcategories) */}
							<Show when={shouldShowSubcategory(subcategory)}>
								<h2 class="text-sm font-semibold text-foreground/80 capitalize border-b border-border/60 pb-1.5">
									{subcategory === 'general' ? 'General' : subcategory}
								</h2>
							</Show>

							{/* Settings list */}
							<div class="divide-y divide-border/60">
								<For each={settings}>
									{(setting) => (
										<SettingItem
											setting={setting}
											value={props.values[setting.key]}
											onChange={(value) =>
												props.onSettingChange(setting.key, value)
											}
										/>
									)}
								</For>
							</div>
						</div>
					)}
				</For>
			</div>

			{/* Empty state */}
			<Show when={categorySettings().length === 0}>
				<div class="flex items-center justify-center h-64 text-center">
					<div class="space-y-2">
						<p class="text-base font-medium text-muted-foreground">
							No settings found
						</p>
						<p class="text-sm text-muted-foreground">
							There are no settings available for the "{props.categoryId}"
							category.
						</p>
					</div>
				</div>
			</Show>
		</SettingsScrollArea>
	)
}
