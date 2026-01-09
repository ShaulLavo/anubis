import { clsx } from 'clsx'
import { createEffect, createRoot, type Accessor, type JSX } from 'solid-js'
import { useTheme } from '@repo/theme'
import { Scrollbar as UiScrollbar } from '@repo/ui/Scrollbar'
import { useScrollbar, type ScrollbarSource } from '@repo/ui/useScrollbar'

export type HorizontalScrollbarProps = {
	/** Height of the scrollbar in pixels */
	height?: number
	/** Custom class name */
	class?: string
	/** Custom styles */
	style?: JSX.CSSProperties
	/** Scroll element accessor */
	scrollElement: Accessor<HTMLElement | null>
	/** Optional content width accessor (for transform-based layout) */
	contentWidth?: Accessor<number>
	/** Optional gutter width accessor */
	gutterWidth?: Accessor<number>
}

const SCROLLBAR_HEIGHT = 14
const SCROLLBAR_MIN_THUMB_WIDTH = 20

export const HorizontalScrollbar = (props: HorizontalScrollbarProps) => {
	const { theme } = useTheme()
	let warnedHiddenScrollbar = false
	const scrollSource = () => createHorizontalScrollSource(props)
	const scrollbar = useScrollbar({
		source: scrollSource,
		scrollElement: props.scrollElement,
		orientation: 'horizontal',
		minThumbSize: SCROLLBAR_MIN_THUMB_WIDTH,
	})

	let warnedMissingElement = false

	const getScrollElementOrWarn = (context: string) => {
		const element = props.scrollElement()
		if (element) return element

		if (!warnedMissingElement) {
			warnedMissingElement = true
			console.log(`HorizontalScrollbar ${context} ignored: missing scroll element`)
		}

		return null
	}

	const scrollToRatio = (ratio: number) => {
		if (!getScrollElementOrWarn('scroll')) return
		scrollbar.scrollToRatio(ratio)
	}

	const scrollBy = (delta: number) => {
		if (!getScrollElementOrWarn('wheel')) return
		scrollbar.scrollBy(delta)
	}

	createEffect(() => {
		const element = props.scrollElement()
		if (!element || warnedHiddenScrollbar) return

		const scrollWidth = element.scrollWidth
		const clientWidth = element.clientWidth
		const hasOverflow = scrollWidth > clientWidth

		if (hasOverflow && !scrollbar.isVisible()) {
			warnedHiddenScrollbar = true
			console.log('Horizontal scrollbar hidden despite overflow', {
				scrollWidth,
				clientWidth,
				contentWidth: props.contentWidth ? props.contentWidth() : 0,
				gutterWidth: props.gutterWidth ? props.gutterWidth() : 0,
			})
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
			class={clsx('horizontal-scrollbar-container', props.class)}
			style={{
				...props.style,
			}}
			orientation="horizontal"
			size={props.height ?? SCROLLBAR_HEIGHT}
			containerRef={scrollbar.setContainerRef}
			thumbOffset={scrollbar.thumbOffset}
			thumbSize={scrollbar.thumbSize}
			isVisible={scrollbar.isVisible}
			onScrollTo={scrollToRatio}
			onScrollBy={scrollBy}
			thumbStyle={resolveThumbStyle}
		/>
	)
}

const createHorizontalScrollSource = (
	props: HorizontalScrollbarProps
): ScrollbarSource | null => {
	const getElement = () => props.scrollElement()
	const getScrollSize = () => {
		const element = getElement()
		if (!element) return 0
		const contentWidth = props.contentWidth ? props.contentWidth() : 0
		const gutterWidth = props.gutterWidth ? props.gutterWidth() : 0
		const measuredWidth = Math.max(contentWidth + gutterWidth, element.scrollWidth)
		return Math.max(measuredWidth, element.clientWidth)
	}
	const getClientSize = () => getElement()?.clientWidth ?? 0
	const getScrollOffset = () => getElement()?.scrollLeft ?? 0
	const setScrollOffset = (offset: number) => {
		const element = getElement()
		if (!element) return
		element.scrollLeft = offset
	}
	const scrollBy = (delta: number) => {
		const element = getElement()
		if (!element) return
		element.scrollLeft += delta
	}
	const subscribe = (listener: () => void) => {
		let element: HTMLElement | null = null
		let resizeObserver: ResizeObserver | null = null

		const handleScroll = () => listener()

		const disposeRoot = createRoot((dispose) => {
			createEffect(() => {
				const next = getElement()
				if (next !== element) {
					if (element) {
						element.removeEventListener('scroll', handleScroll)
					}
					resizeObserver?.disconnect()
					resizeObserver = null
					element = next

					if (element) {
						element.addEventListener('scroll', handleScroll, { passive: true })
						resizeObserver = new ResizeObserver(handleScroll)
						resizeObserver.observe(element)
					}
				}

				props.contentWidth?.()
				props.gutterWidth?.()
				listener()
			})
			return dispose
		})

		return () => {
			if (element) {
				element.removeEventListener('scroll', handleScroll)
			}
			resizeObserver?.disconnect()
			disposeRoot()
		}
	}

	return {
		getScrollSize,
		getClientSize,
		getScrollOffset,
		setScrollOffset,
		scrollBy,
		subscribe,
	}
}
