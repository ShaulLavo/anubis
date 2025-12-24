// Re-export shared shift utilities for use in this worker
export {
	shiftCaptures,
	shiftBrackets,
	shiftFolds,
	getEditCharDelta,
	getEditLineDelta,
} from '@repo/utils/highlightShift'

// Apply a text edit to a string
export const applyTextEdit = (
	text: string,
	startIndex: number,
	oldEndIndex: number,
	insertedText: string
) => text.slice(0, startIndex) + insertedText + text.slice(oldEndIndex)

/**
 * Determines if an edit can be handled by shifting indices
 * rather than re-running tree-sitter queries.
 * Safe for pure insertions of whitespace/newlines.
 */
export const isShiftableEdit = (
	insertedText: string,
	startIndex: number,
	oldEndIndex: number
): boolean => {
	const isInsertion = oldEndIndex === startIndex
	const isWhitespaceOnly = /^\s*$/.test(insertedText)
	const hasContent = insertedText.length > 0
	return isInsertion && isWhitespaceOnly && hasContent
}
