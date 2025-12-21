import { JSX, Show } from 'solid-js'
import { VsChevronDown } from '@repo/icons/vs/VsChevronDown'
import { VsChevronRight } from '@repo/icons/vs/VsChevronRight'
import { DEFAULT_GUTTER_MODE } from '../../consts'

interface LineGutterProps {
	lineNumber: number
	lineHeight: number
	isActive: boolean
	isFoldable?: boolean
	isFolded?: boolean
	onFoldClick?: () => void
}

const getGutterStyle = (lineHeight: number, lineNumber: number) => {
	const styles: JSX.CSSProperties = { height: `${lineHeight}px` }

	if (DEFAULT_GUTTER_MODE !== 'decimal') {
		styles['counter-set'] = `line ${lineNumber}`
		styles['--gutter-style'] = DEFAULT_GUTTER_MODE
	}

	return styles
}

export const LineGutter = (props: LineGutterProps) => {
	return (
		<span
			class="shrink-0 select-none text-[11px] font-semibold tracking-[0.08em] tabular-nums flex items-center justify-between gap-1 "
			classList={{
				'text-white': props.isActive,
				'text-zinc-500': !props.isActive,
			}}
			style={getGutterStyle(props.lineHeight, props.lineNumber)}
		>
			<span
				class="flex-1 text-right"
				classList={{ 'line-number': DEFAULT_GUTTER_MODE !== 'decimal' }}
			>
				{DEFAULT_GUTTER_MODE === 'decimal' ? props.lineNumber : null}
			</span>
			<Show when={props.isFoldable} fallback={<span class="w-4 shrink-0" />}>
				<button
					type="button"
					class="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800/60 focus-visible:outline focus-visible:outline-zinc-500"
					aria-label={props.isFolded ? 'Expand fold' : 'Collapse fold'}
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation()
						props.onFoldClick?.()
					}}
				>
					<Show when={props.isFolded} fallback={<VsChevronDown size={12} />}>
						<VsChevronRight size={12} />
					</Show>
				</button>
			</Show>
		</span>
	)
}
