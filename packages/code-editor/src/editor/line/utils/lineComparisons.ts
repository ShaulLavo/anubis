import type { LineBracketDepthMap, LineHighlightSegment } from '../../types'

/**
 * Deep equality check for highlight segments arrays.
 * Returns true if both arrays have the same segments in the same order.
 */
export const areHighlightSegmentsEqual = (
	a: LineHighlightSegment[] | undefined,
	b: LineHighlightSegment[] | undefined
): boolean => {
	if (a === b) return true
	if (!a || !b) return false
	if (a.length !== b.length) return false

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
			return false
		}
	}
	return true
}

/**
 * Deep equality check for bracket depth maps.
 * Returns true if both maps have the same keys and values.
 */
export const areBracketDepthsEqual = (
	a: LineBracketDepthMap | undefined,
	b: LineBracketDepthMap | undefined
): boolean => {
	if (a === b) return true
	if (!a || !b) return false
	const keysA = Object.keys(a)
	const keysB = Object.keys(b)
	if (keysA.length !== keysB.length) return false

	for (let i = 0; i < keysA.length; i++) {
		const key = keysA[i]!
		if (a[key as unknown as number] !== b[key as unknown as number])
			return false
	}
	return true
}
