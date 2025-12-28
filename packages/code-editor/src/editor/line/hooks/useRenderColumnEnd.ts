import { createMemo, type Accessor } from 'solid-js'

import type { VirtualItem2D } from '../../types'
import { VIRTUALIZATION_THRESHOLD } from '../../hooks/create2DVirtualizer'

export type UseRenderColumnEndOptions = {
	virtualRow: Accessor<VirtualItem2D>
	lineText: Accessor<string>
}

export const useRenderColumnEnd = (
	options: UseRenderColumnEndOptions
): Accessor<number> => {
	const renderColumnEnd = createMemo(() => {
		const textLength = options.lineText().length
		const columnEnd = options.virtualRow().columnEnd
		if (textLength <= VIRTUALIZATION_THRESHOLD && textLength > columnEnd) {
			return textLength
		}
		return columnEnd
	})
	return renderColumnEnd
}
