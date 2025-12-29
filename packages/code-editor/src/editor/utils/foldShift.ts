import type { FoldRange, HighlightOffset } from '../types'

/**
 * Binary search to find the first fold index where endLine >= target.
 * Returns folds.length if no such fold exists.
 */
const findFirstAffectedFold = (
	folds: FoldRange[],
	targetLine: number
): number => {
	let lo = 0
	let hi = folds.length

	while (lo < hi) {
		const mid = (lo + hi) >>> 1
		if (folds[mid]!.endLine < targetLine) {
			lo = mid + 1
		} else {
			hi = mid
		}
	}

	return lo
}

/**
 * Shift fold ranges based on edit offsets.
 * Similar to highlight offset logic, but operates on line numbers instead of character indices.
 *
 * When a line is added/removed, folds that start or end after the edit need to be shifted.
 *
 * Optimized: Uses binary search to skip folds that are entirely before the edit.
 */
export const shiftFoldRanges = (
	folds: FoldRange[] | undefined,
	offsets: HighlightOffset[] | undefined
): FoldRange[] | undefined => {
	if (!folds?.length || !offsets?.length) {
		return folds
	}

	// Fast path: check if any offset has a line delta
	// Most single-char edits don't change line count
	let hasLineDelta = false
	let minFromRow = Infinity
	for (const offset of offsets) {
		if (offset.lineDelta !== 0 || offset.oldEndRow !== offset.newEndRow) {
			hasLineDelta = true
			minFromRow = Math.min(minFromRow, offset.fromLineRow)
		}
	}

	if (!hasLineDelta) {
		// No line changes - folds are unchanged
		return folds
	}

	// Find first fold that might be affected (endLine >= minFromRow)
	const startIdx = findFirstAffectedFold(folds, minFromRow)

	if (startIdx >= folds.length) {
		// All folds are before the edit - no changes needed
		return folds
	}

	// Copy unaffected folds directly
	const result: FoldRange[] = folds.slice(0, startIdx)

	// Process potentially affected folds
	for (let i = startIdx; i < folds.length; i++) {
		const fold = folds[i]!
		let startLine = fold.startLine
		let endLine = fold.endLine

		for (const offset of offsets) {
			const lineDelta = offset.lineDelta
			const fromRow = offset.fromLineRow
			const oldEndRow = offset.oldEndRow
			const newEndRow = offset.newEndRow

			if (lineDelta === 0 && oldEndRow === newEndRow) {
				continue
			}

			if (endLine < fromRow) {
				continue
			}

			if (startLine > oldEndRow) {
				startLine += lineDelta
				endLine += lineDelta
				continue
			}

			const isInsertAtFoldStart =
				lineDelta > 0 && startLine === fromRow && oldEndRow === fromRow

			if (isInsertAtFoldStart) {
				startLine += lineDelta
				endLine += lineDelta
				continue
			}

			if (startLine <= fromRow) {
				if (endLine > oldEndRow) {
					endLine += lineDelta
				} else if (endLine >= fromRow && endLine <= oldEndRow) {
					if (lineDelta < 0) {
						endLine = Math.max(startLine + 1, newEndRow)
					} else {
						endLine = newEndRow
					}
				}
			} else {
				if (lineDelta > 0) {
					const shiftAmount = startLine - fromRow
					startLine = newEndRow + shiftAmount - (oldEndRow - fromRow)
					endLine += lineDelta
				} else {
					startLine = fromRow
					endLine = Math.max(startLine + 1, endLine + lineDelta)
				}
			}
		}

		if (endLine > startLine && startLine >= 0) {
			result.push({
				startLine,
				endLine,
				type: fold.type,
			})
		}
	}

	return result.length > 0 ? result : undefined
}
