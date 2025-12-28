import { Show, createMemo, type Accessor } from 'solid-js'

import type {
	LineBracketDepthMap,
	LineEntry,
	LineHighlightSegment,
	VirtualItem2D,
} from '../../types'
import type { TextRun } from '../utils/textRuns'
import { useLineResolution } from '../hooks/useLineResolution'
import { useLineEntry } from '../hooks/useLineEntry'
import { useLineHighlights } from '../hooks/useLineHighlights'
import { useLineBracketDepths } from '../hooks/useLineBracketDepths'
import { useCachedRuns } from '../hooks/useCachedRuns'
import { useRenderColumnEnd } from '../hooks/useRenderColumnEnd'
import { Line } from './Line'

export type LineRowProps = {
	virtualRow: VirtualItem2D
	lineHeight: Accessor<number>
	contentWidth: Accessor<number>
	charWidth: Accessor<number>
	tabSize: Accessor<number>
	isEditable: Accessor<boolean>
	onPreciseClick: (
		lineIndex: number,
		column: number,
		shiftKey?: boolean
	) => void
	onMouseDown?: (
		event: MouseEvent,
		lineIndex: number,
		column: number,
		textElement: HTMLElement | null
	) => void
	activeLineIndex: Accessor<number | null>
	getLineBracketDepths: (entry: LineEntry) => LineBracketDepthMap | undefined
	getLineHighlights?: (entry: LineEntry) => LineHighlightSegment[] | undefined
	highlightRevision?: Accessor<number>
	getCachedRuns?: (
		lineIndex: number,
		columnStart: number,
		columnEnd: number,
		lineId?: number
	) => TextRun[] | undefined
	displayToLine?: (displayIndex: number) => number
}

export const LineRow = (props: LineRowProps) => {
	const virtualRow = () => props.virtualRow

	const { resolvedLineId, lineIndex, isLineValid, lineText } =
		useLineResolution({
			virtualRow,
			displayToLine: () => props.displayToLine,
		})

	const entry = useLineEntry({
		resolvedLineId,
		lineIndex,
		isLineValid,
		lineText,
	})

	const highlights = useLineHighlights({
		entry,
		getLineHighlights: () => props.getLineHighlights,
		highlightRevision: () => props.highlightRevision?.(),
	})

	const lineBracketDepths = useLineBracketDepths({
		entry,
		getLineBracketDepths: () => props.getLineBracketDepths,
	})

	const cachedRuns = useCachedRuns({
		virtualRow,
		resolvedLineId,
		lineIndex,
		isLineValid,
		getCachedRuns: () => props.getCachedRuns,
	})

	const renderColumnEnd = useRenderColumnEnd({
		virtualRow,
		lineText,
	})

	const isActive = createMemo(() => props.activeLineIndex() === lineIndex())

	return (
		<Show when={isLineValid()}>
			<Line
				virtualRow={props.virtualRow}
				lineIndex={lineIndex()}
				lineText={lineText()}
				lineHeight={props.lineHeight()}
				contentWidth={props.contentWidth()}
				charWidth={props.charWidth()}
				tabSize={props.tabSize()}
				isEditable={props.isEditable}
				onPreciseClick={props.onPreciseClick}
				onMouseDown={props.onMouseDown}
				isActive={isActive()}
				lineBracketDepths={lineBracketDepths()}
				highlights={highlights()}
				cachedRuns={cachedRuns()}
				columnEndOverride={renderColumnEnd()}
			/>
		</Show>
	)
}
