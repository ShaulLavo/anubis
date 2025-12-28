import { createMemo, type Accessor } from 'solid-js'

import type { LineBracketDepthMap, LineEntry } from '../../types'
import { areBracketDepthsEqual } from '../utils/lineComparisons'

export type UseLineBracketDepthsOptions = {
	entry: Accessor<LineEntry | null>
	getLineBracketDepths: Accessor<
		(entry: LineEntry) => LineBracketDepthMap | undefined
	>
}

export const useLineBracketDepths = (
	options: UseLineBracketDepthsOptions
): Accessor<LineBracketDepthMap | undefined> => {
	const lineBracketDepths = createMemo(
		() => {
			const e = options.entry()
			return e ? options.getLineBracketDepths()(e) : undefined
		},
		undefined,
		{ equals: areBracketDepthsEqual }
	)
	return lineBracketDepths
}
