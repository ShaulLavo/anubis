import { VsClose } from '@repo/icons/vs/VsClose'
import { VsCircleFilled } from '@repo/icons/vs/VsCircleFilled'
import { createSignal, Show } from 'solid-js'
import { FileIcon } from './FileIcon'
import { Button } from '@repo/ui/button'

type TabProps = {
	value: string
	label: string
	isActive?: boolean
	isDirty?: boolean
	onSelect?: (value: string) => void
	onClose?: (value: string) => void
	title?: string
}

export const Tab = (props: TabProps) => {
	const [isHovering, setIsHovering] = createSignal(false)

	const handleSelect = () => {
		props.onSelect?.(props.value)
	}

	const handleClose = (e: MouseEvent) => {
		e.stopPropagation()
		props.onClose?.(props.value)
	}

	return (
		<Button
			variant="ghost"
			role="tab"
			tabIndex={props.isActive ? 0 : -1}
			onClick={handleSelect}
			title={props.title ?? props.value}
			class={
				'h-auto gap-2 px-3 py-1 font-semibold transition-colors group rounded-none first:border-l text-ui ' +
				'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none ring-0 outline-none ' +
				'hover:bg-muted/50 hover:text-foreground ' +
				(props.isActive
					? 'bg-background text-foreground'
					: 'text-muted-foreground')
			}
			aria-selected={props.isActive}
		>
			<FileIcon name={props.label} size={14} class="shrink-0" />
			<span class="max-w-48 truncate">{props.label}</span>

			{props.onClose && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={handleClose}
					onMouseEnter={() => setIsHovering(true)}
					onMouseLeave={() => setIsHovering(false)}
					class={
						'h-4 w-4 hover:bg-muted rounded p-0.5 transition-opacity ' +
						(props.isDirty
							? 'opacity-100'
							: 'opacity-0 group-hover:opacity-100')
					}
					title={`Close ${props.label}`}
				>
					<Show
						when={props.isDirty && !isHovering()}
						fallback={<VsClose class="h-3 w-3" />}
					>
						<VsCircleFilled class="h-2.5 w-2.5" />
					</Show>
				</Button>
			)}
		</Button>
	)
}
