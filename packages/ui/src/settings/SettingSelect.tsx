import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { cn } from '../utils'

export type SettingSelectOption = {
	value: string
	label: string
}

export type SettingSelectProps = {
	value: string
	options: SettingSelectOption[]
	onChange: (value: string) => void
	label: string
	description?: string
	class?: string
}

export const SettingSelect: Component<SettingSelectProps> = (props) => {
	const handleChange = (event: Event) => {
		const target = event.target as HTMLSelectElement
		props.onChange(target.value)
	}

	return (
		<div class={cn('space-y-1', props.class)}>
			<label class="text-sm font-medium text-foreground">
				{props.label}
			</label>
			{props.description && (
				<p class="text-sm text-muted-foreground">
					{props.description}
				</p>
			)}
			<select
				value={props.value}
				onChange={handleChange}
				class={cn(
					'flex h-8 w-full rounded-sm border border-border/60 bg-background px-2 py-1 text-sm',
					'ring-offset-background',
					'focus-visible:outline-none focus-visible:border-foreground/40',
					'disabled:cursor-not-allowed disabled:opacity-50'
				)}
			>
				<For each={props.options}>
					{(option) => (
						<option value={option.value}>
							{option.label}
						</option>
					)}
				</For>
			</select>
		</div>
	)
}
