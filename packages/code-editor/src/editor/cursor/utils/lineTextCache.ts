export type LineTextCacheUpdate = {
	startLine: number
	endLine: number
	lineDelta: number
}

export const countLineBreaks = (text: string): number => {
	if (!text) return 0
	let count = 0
	let index = text.indexOf('\n')

	while (index !== -1) {
		count += 1
		index = text.indexOf('\n', index + 1)
	}

	return count
}

export const updateLineTextCache = (
	cache: Map<number, string>,
	update: LineTextCacheUpdate
): number => {
	if (cache.size === 0) return 0

	const startLine = Math.max(0, update.startLine)
	const endLine = Math.max(startLine, update.endLine)
	const lineDelta = update.lineDelta

	if (lineDelta === 0 && startLine === endLine) {
		cache.delete(startLine)
		return cache.size
	}

	const nextEntries: Array<[number, string]> = []

	for (const [lineIndex, text] of cache) {
		if (lineIndex < startLine) {
			nextEntries.push([lineIndex, text])
			continue
		}

		if (lineIndex > endLine) {
			const shifted = lineIndex + lineDelta
			if (shifted >= 0) {
				nextEntries.push([shifted, text])
			}
		}
	}

	cache.clear()
	for (const [lineIndex, text] of nextEntries) {
		cache.set(lineIndex, text)
	}

	return cache.size
}
