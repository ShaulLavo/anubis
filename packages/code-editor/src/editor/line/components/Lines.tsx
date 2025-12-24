import { For, Show, createEffect, createMemo } from 'solid-js'
import { endGlobalTrace, hasGlobalTrace } from '@repo/perf'
import { useCursor } from '../../cursor'
import type { LineEntry, LinesProps } from '../../types'
import { Line } from './Line'

export const Lines = (props: LinesProps) => {
	const cursor = useCursor()

	// End keystroke trace when Lines re-renders (triggered by cursor/text changes)
	createEffect(() => {
		// Track cursor position to trigger on text changes
		void cursor.state.position.offset
		void cursor.lines.lineCount()

		// Use queueMicrotask to measure after Solid's render completes
		queueMicrotask(() => {
			if (hasGlobalTrace('keystroke')) {
				endGlobalTrace('keystroke', 'render')
			}
		})
	})

	return (
		<div class="relative flex-1">
			<For each={props.rows()}>
				{(virtualRow) => {
					const lineIndex = createMemo(() =>
						props.displayToLine
							? props.displayToLine(virtualRow.index)
							: virtualRow.index
					)

					const entry = createMemo<LineEntry | null>(() => {
						const idx = lineIndex()
						if (idx < 0 || idx >= cursor.lines.lineCount()) {
							return null
						}
						return {
							index: idx,
							start: cursor.lines.getLineStart(idx),
							length: cursor.lines.getLineLength(idx),
							text: cursor.lines.getLineText(idx),
						}
					})

					const highlights = createMemo(
						() => {
							const e = entry()
							return e ? props.getLineHighlights?.(e) : undefined
						},
						undefined,
						{
							equals: (a, b) => {
								if (a === b) return true
								if (!a || !b) return false
								if (a.length !== b.length) {
									// console.log('Length mismatch', a.length, b.length)
									return false
								}
								for (let i = 0; i < a.length; i++) {
									const sA = a[i]
									const sB = b[i]
									if (
										!sA ||
										!sB ||
										sA.start !== sB.start ||
										sA.end !== sB.end ||
										sA.className !== sB.className
									) {
										// console.log('Segment mismatch', i, sA, sB)
										return false
									}
								}
								return true
							},
						}
					)

					const lineBracketDepths = createMemo(
						() => {
							const e = entry()
							return e ? props.getLineBracketDepths(e) : undefined
						},
						undefined,
						{
							equals: (a, b) => {
								if (a === b) return true
								if (!a || !b) return false
								const keysA = Object.keys(a)
								const keysB = Object.keys(b)
								if (keysA.length !== keysB.length) return false

								for (let i = 0; i < keysA.length; i++) {
									const key = keysA[i]!
									// @ts-ignore - keys are numbers in type but strings in Object.keys
									if (a[key] !== b[key]) return false
								}
								return true
							},
						}
					)

					// Try to get cached runs for instant rendering
					const cachedRuns = createMemo(() => {
						const idx = lineIndex()
						return props.getCachedRuns?.(
							idx,
							virtualRow.columnStart,
							virtualRow.columnEnd
						)
					})

					return (
						<Show when={entry()}>
							{(validEntry) => (
								<Line
									virtualRow={virtualRow}
									entry={validEntry()}
									lineHeight={props.lineHeight()}
									contentWidth={props.contentWidth()}
									charWidth={props.charWidth()}
									tabSize={props.tabSize()}
									isEditable={props.isEditable}
									onPreciseClick={props.onPreciseClick}
									onMouseDown={props.onMouseDown}
									isActive={props.activeLineIndex() === lineIndex()}
									lineBracketDepths={lineBracketDepths()}
									highlights={highlights()}
									cachedRuns={cachedRuns()}
								/>
							)}
						</Show>
					)
				}}
			</For>
		</div>
	)
}
