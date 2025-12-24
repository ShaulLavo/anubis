/**
 * Shared utilities for shifting syntax highlight positions after text edits.
 * Used for optimistic UI updates (immediate response) and worker-side batch processing.
 */

// Generic capture type - works with both TreeSitterCapture and EditorSyntaxHighlight
export type ShiftableCapture = {
	startIndex: number
	endIndex: number
}

export type ShiftableBracket = {
	index: number
}

export type ShiftableFold = {
	startLine: number
	endLine: number
}

/**
 * Compute the character delta from an edit.
 */
export const getEditCharDelta = (edit: {
	insertedText: string
	newEndIndex?: number
	oldEndIndex?: number
}): number => {
	if (
		typeof edit.newEndIndex === 'number' &&
		typeof edit.oldEndIndex === 'number'
	) {
		return edit.newEndIndex - edit.oldEndIndex
	}

	return edit.insertedText.length
}

/**
 * Compute the line delta from an edit.
 */
export const getEditLineDelta = (edit: {
	startPosition?: { row: number }
	oldEndPosition?: { row: number }
	newEndPosition?: { row: number }
}): number => {
	const startRow = edit.startPosition?.row
	const oldEndRow = edit.oldEndPosition?.row
	const newEndRow = edit.newEndPosition?.row

	const hasNewEndRow = typeof newEndRow === 'number'
	const hasOldEndRow = typeof oldEndRow === 'number'
	const hasStartRow = typeof startRow === 'number'

	if (hasNewEndRow && hasOldEndRow) return newEndRow - oldEndRow
	if (hasNewEndRow && hasStartRow) return newEndRow - startRow
	return 0
}

/**
 * Shifts capture indices after a text edit.
 * Returns a new array with shifted captures.
 */
export const shiftCaptures = <T extends ShiftableCapture>(
	captures: T[],
	insertPosition: number,
	delta: number
): T[] => {
	return captures.map((capture) => {
		const startsAfterInsert = capture.startIndex >= insertPosition
		const endsAfterInsert = capture.endIndex > insertPosition

		const newStartIndex = startsAfterInsert
			? capture.startIndex + delta
			: capture.startIndex
		const newEndIndex = endsAfterInsert
			? capture.endIndex + delta
			: capture.endIndex

		return {
			...capture,
			startIndex: newStartIndex,
			endIndex: newEndIndex,
		}
	})
}

/**
 * Shifts bracket indices after a text edit.
 * Returns a new array with shifted brackets.
 */
export const shiftBrackets = <T extends ShiftableBracket>(
	brackets: T[],
	insertPosition: number,
	delta: number
): T[] => {
	return brackets.map((bracket) => {
		const isAfterInsert = bracket.index >= insertPosition
		const newIndex = isAfterInsert ? bracket.index + delta : bracket.index

		return {
			...bracket,
			index: newIndex,
		}
	})
}

/**
 * Shifts fold ranges after a line edit.
 * Filters out folds that become invalid (endLine <= startLine) after shifting.
 */
export const shiftFolds = <T extends ShiftableFold>(
	folds: T[],
	insertLineRow: number,
	lineDelta: number
): T[] => {
	return folds
		.map((fold) => {
			const startAfterInsert = fold.startLine >= insertLineRow
			const endAfterInsert = fold.endLine >= insertLineRow

			const newStartLine = startAfterInsert
				? fold.startLine + lineDelta
				: fold.startLine
			const newEndLine = endAfterInsert
				? fold.endLine + lineDelta
				: fold.endLine

			return {
				...fold,
				startLine: newStartLine,
				endLine: newEndLine,
			}
		})
		.filter((fold) => fold.endLine > fold.startLine)
}
