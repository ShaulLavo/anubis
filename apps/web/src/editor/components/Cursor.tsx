import {
	Show,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	onMount
} from 'solid-js'
import type { Accessor } from 'solid-js'
import { estimateLineHeight } from '../utils'
import type { CursorState } from '../cursor'

const CURSOR_WIDTH = 2
const CURSOR_HEIGHT_SHRINK = 2

export type CursorProps = {
	cursorState: Accessor<CursorState>
	fontSize: number
	fontFamily: string
	charWidth: number
	lineNumberWidth: number
	paddingLeft: number
	visibleLineStart: number
	visibleLineEnd: number
	getLineY: (lineIndex: number) => number
}

export const Cursor = (props: CursorProps) => {
	const [visible, setVisible] = createSignal(true)

	let blinkInterval: ReturnType<typeof setInterval> | null = null

	onMount(() => {
		blinkInterval = setInterval(() => {
			if (props.cursorState().isBlinking) {
				setVisible(v => !v)
			} else {
				setVisible(true)
			}
		}, 530)
	})

	onCleanup(() => {
		if (blinkInterval) {
			clearInterval(blinkInterval)
		}
	})

	createEffect(
		on(
			() => props.cursorState().position.offset,
			() => {
				setVisible(true)
			}
		)
	)

	const isVisible = createMemo(() => {
		const line = props.cursorState().position.line
		return line >= props.visibleLineStart && line <= props.visibleLineEnd
	})

	const cursorX = createMemo(() => {
		const column = props.cursorState().position.column
		return props.lineNumberWidth + props.paddingLeft + column * props.charWidth
	})

	const cursorY = createMemo(() => {
		const line = props.cursorState().position.line
		return props.getLineY(line) + CURSOR_HEIGHT_SHRINK / 2
	})

	const cursorHeight = createMemo(() => {
		return estimateLineHeight(props.fontSize) - CURSOR_HEIGHT_SHRINK
	})

	return (
		<Show when={isVisible()}>
			<div
				class="pointer-events-none absolute z-10"
				hidden={!visible()}
				style={{
					left: `${cursorX()}px`,
					top: `${cursorY()}px`,
					width: `${CURSOR_WIDTH}px`,
					height: `${cursorHeight()}px`,
					'background-color': '#e4e4e7',
					'border-radius': '1px'
				}}
			/>
		</Show>
	)
}
