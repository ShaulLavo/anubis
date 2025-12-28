import { createMemo, type Accessor } from 'solid-js'

import type { VirtualItem2D } from '../../types'
import type { TextRun } from '../utils/textRuns'

export type UseCachedRunsOptions = {
	virtualRow: Accessor<VirtualItem2D>
	resolvedLineId: Accessor<number>
	lineIndex: Accessor<number>
	isLineValid: Accessor<boolean>
	getCachedRuns: Accessor<
		| ((
				lineIndex: number,
				columnStart: number,
				columnEnd: number,
				lineId?: number
		  ) => TextRun[] | undefined)
		| undefined
	>
}

export const useCachedRuns = (
	options: UseCachedRunsOptions
): Accessor<TextRun[] | undefined> => {
	const cachedRuns = createMemo(() => {
		const getCachedRuns = options.getCachedRuns()
		if (!getCachedRuns) return undefined
		if (!options.isLineValid()) return undefined
		const idx = options.lineIndex()
		const lineId = options.resolvedLineId()
		const vr = options.virtualRow()
		return getCachedRuns(idx, vr.columnStart, vr.columnEnd, lineId)
	})
	return cachedRuns
}
