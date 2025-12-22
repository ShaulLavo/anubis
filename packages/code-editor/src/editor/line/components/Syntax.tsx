import { For } from 'solid-js'
import type { LineBracketDepthMap, LineHighlightSegment } from '../../types'
import { useTextRuns } from '../hooks/useTextRuns'
import { Token } from './Token'
import type { TextRun } from '../utils/textRuns'

type SyntaxProps = {
	text: string
	bracketDepths?: LineBracketDepthMap
	highlightSegments?: LineHighlightSegment[]
	columnStart?: number
	columnEnd?: number
	/** Pre-computed TextRuns from cache for instant rendering */
	cachedRuns?: TextRun[]
}

/**
 * Renders a line of text with syntax highlighting and bracket coloring.
 * Text is grouped into styled "runs" for efficient DOM rendering.
 * If cachedRuns are provided, uses them directly for instant rendering.
 */
export const Syntax = (props: SyntaxProps) => {
	const computedRuns = useTextRuns({
		text: () => props.text,
		bracketDepths: () => props.bracketDepths,
		highlightSegments: () => props.highlightSegments,
		columnStart: () => props.columnStart,
		columnEnd: () => props.columnEnd,
	})

	// Use cached runs if available, otherwise compute them
	const runs = () => props.cachedRuns ?? computedRuns()

	return <For each={runs()}>{(run) => <Token {...run} />}</For>
}
