import { createMemo, untrack, type Accessor } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { CursorState } from '../types'
import { createDefaultCursorState } from '../types'
import { offsetToPosition } from '../utils/position'

type UseCursorStateManagerOptions = {
	filePath: () => string | undefined
	lineStarts: () => number[]
	documentLength: () => number
}

export type CursorStateManager = {
	currentState: Accessor<CursorState>
	updateCurrentState: (
		updater: (prev: CursorState) => Partial<CursorState>
	) => void
}

const clampSelectionsToLength = (
	selections: CursorState['selections'],
	documentLength: number
): CursorState['selections'] => {
	if (selections.length === 0) return selections

	let next: CursorState['selections'] | null = null

	for (let i = 0; i < selections.length; i++) {
		const selection = selections[i]!

		const anchor = Math.min(selection.anchor, documentLength)
		const focus = Math.min(selection.focus, documentLength)

		if (anchor === selection.anchor && focus === selection.focus) {
			if (next) next.push(selection)
			continue
		}

		if (!next) next = selections.slice(0, i)
		next.push({ anchor, focus })
	}

	return next ?? selections
}

const clampCursorStateToDocument = (
	state: CursorState,
	lineStarts: number[],
	documentLength: number
): CursorState => {
	const safeDocLength = Math.max(0, documentLength)
	const clampedOffset = Math.min(
		Math.max(0, state.position.offset),
		safeDocLength
	)
	const selections = clampSelectionsToLength(state.selections, safeDocLength)

	let next = state

	if (clampedOffset !== state.position.offset) {
		const position = offsetToPosition(
			clampedOffset,
			lineStarts.length > 0 ? lineStarts : [0],
			safeDocLength
		)
		next = { ...next, position, preferredColumn: position.column }
	}

	if (selections !== state.selections) {
		next = { ...next, selections }
	}

	return next
}

const areCursorStatesEqual = (a: CursorState, b: CursorState): boolean => {
	if (a.hasCursor !== b.hasCursor) return false
	if (a.isBlinking !== b.isBlinking) return false
	if (a.preferredColumn !== b.preferredColumn) return false

	if (a.position.offset !== b.position.offset) return false
	if (a.position.line !== b.position.line) return false
	if (a.position.column !== b.position.column) return false

	if (a.selections.length !== b.selections.length) return false
	for (let i = 0; i < a.selections.length; i++) {
		const selA = a.selections[i]
		const selB = b.selections[i]
		if (!selA || !selB) return false
		if (selA.anchor !== selB.anchor) return false
		if (selA.focus !== selB.focus) return false
	}

	return true
}

export function useCursorStateManager(
	options: UseCursorStateManagerOptions
): CursorStateManager {
	const [cursorStates, setCursorStates] = createStore<
		Record<string, CursorState>
	>({})

	const currentPath = createMemo(() => options.filePath())

	const currentState = createMemo((): CursorState => {
		const path = currentPath()
		if (!path) {
			return createDefaultCursorState()
		}
		return cursorStates[path] ?? createDefaultCursorState()
	})

	const updateCurrentState = (
		updater: (prev: CursorState) => Partial<CursorState>
	) => {
		const path = untrack(() => currentPath())
		if (!path) return

		const current =
			untrack(() => cursorStates[path]) ?? createDefaultCursorState()
		const updates = updater(current)

		const lineStarts = untrack(() => options.lineStarts())
		const documentLength = untrack(() => options.documentLength())

		const next = clampCursorStateToDocument(
			{ ...current, ...updates },
			lineStarts,
			documentLength
		)

		if (areCursorStatesEqual(current, next)) return
		setCursorStates(path, next)
	}

	return {
		currentState,
		updateCurrentState,
	}
}
