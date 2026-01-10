import { clsx } from 'clsx'
import { createEffect, createSignal, type Accessor, type JSX } from 'solid-js'
import { useTheme } from '@repo/theme'
import { Scrollbar as UiScrollbar } from '@repo/ui/Scrollbar'
import { useScrollbar, type ScrollbarSource } from '@repo/ui/useScrollbar'
import type { TerminalController } from './terminalController'

export type TerminalScrollbarProps = {
	controller: Accessor<TerminalController | null>
	size?: number
	class?: string
	style?: JSX.CSSProperties
}

const SCROLLBAR_WIDTH = 12
const SCROLLBAR_MIN_THUMB = 20

export const TerminalScrollbar = (props: TerminalScrollbarProps) => {
	const { theme } = useTheme()
	let warnedMissingSource = false
	let warnedHiddenScrollbar = false
	const [scrollSource, setScrollSource] = createSignal<ScrollbarSource | null>(
		null
	)
	const [scrollElement, setScrollElement] = createSignal<HTMLElement | null>(
		null
	)

	createEffect(() => {
		const controller = props.controller()
		if (!controller) {
			setScrollSource(() => null)
			setScrollElement(() => null)
			return
		}

		const unsubscribe = controller.onScrollTargetsChange((targets) => {
			setScrollSource(() => targets.scrollSource)
			setScrollElement(() => targets.scrollElement)
		})

		return () => {
			unsubscribe()
		}
	})

	const scrollbar = useScrollbar({
		source: scrollSource,
		scrollElement,
		minThumbSize: SCROLLBAR_MIN_THUMB,
	})

	createEffect(() => {
		const source = scrollSource()
		const element = scrollElement()
		if (!source && !element) {
			if (!warnedMissingSource) {
				// warnedMissingSource = true
			}
			return
		}
		if (!source || warnedHiddenScrollbar) return

		const scrollSize = source.getScrollSize()
		const clientSize = source.getClientSize()
		const hasOverflow = scrollSize > clientSize
		if (hasOverflow && !scrollbar.isVisible()) {
			warnedHiddenScrollbar = true
		}
	})

	const resolveThumbStyle = (state: {
		isHovered: boolean
		isDragging: boolean
	}) => ({
		'background-color':
			theme.editor.scrollbarThumb ??
			(state.isDragging
				? 'rgba(255, 255, 255, 0.3)'
				: state.isHovered
					? 'rgba(255, 255, 255, 0.12)'
					: 'rgba(255, 255, 255, 0.08)'),
		opacity: state.isDragging ? 0.8 : state.isHovered ? 0.6 : 0.4,
		'border-radius': '0px',
		transition: state.isDragging ? 'none' : 'background-color 0.15s ease',
		'backdrop-filter': 'blur(4px)',
	})

	return (
		<UiScrollbar
			class={clsx('terminal-scrollbar', props.class)}
			style={{
				position: 'absolute',
				top: '0px',
				right: '0px',
				height: '100%',
				...props.style,
			}}
			size={props.size ?? SCROLLBAR_WIDTH}
			containerRef={scrollbar.setContainerRef}
			thumbOffset={scrollbar.thumbOffset}
			thumbSize={scrollbar.thumbSize}
			isVisible={scrollbar.isVisible}
			onScrollTo={scrollbar.scrollToRatio}
			onScrollBy={scrollbar.scrollBy}
			thumbStyle={resolveThumbStyle}
		/>
	)
}
