import { createEffect, on, type Accessor } from 'solid-js'
import { ReactiveSet } from '@solid-primitives/set'
import type { FoldRange } from '../types'

export type UseFoldedStartsOptions = {
	filePath: Accessor<string | undefined>
	folds?: Accessor<FoldRange[] | undefined>
	scrollElement: Accessor<HTMLDivElement | null>
}

export const useFoldedStarts = (options: UseFoldedStartsOptions) => {
	const foldedStarts = new ReactiveSet<number>()

	const toggleFold = (startLine: number) => {
		const foldRanges = options.folds?.()
		if (
			!foldRanges?.some(
				(range) =>
					range.startLine === startLine && range.endLine > range.startLine
			)
		) {
			return
		}

		if (foldedStarts.has(startLine)) {
			foldedStarts.delete(startLine)
		} else {
			foldedStarts.add(startLine)
		}
	}

	// Track previous file path to detect actual file switches vs initial load
	let previousFilePath: string | undefined

	createEffect(
		on(options.filePath, (currentPath) => {
			// Only reset scroll when switching from one file to another,
			// not on initial load (when previousFilePath is undefined)
			const isFileSwitch = previousFilePath !== undefined && previousFilePath !== currentPath

			if (isFileSwitch) {
				const element = options.scrollElement()
				if (element) {
					element.scrollTop = 0
					element.scrollLeft = 0
				}
			}

			previousFilePath = currentPath
			foldedStarts.clear()
		})
	)

	createEffect(
		on(
			() => options.folds?.(),
			(folds) => {
				if (!folds?.length) {
					foldedStarts.clear()
					return
				}

				const validStarts = new Set(
					folds.filter((f) => f.endLine > f.startLine).map((f) => f.startLine)
				)

				for (const start of foldedStarts) {
					if (!validStarts.has(start)) {
						foldedStarts.delete(start)
					}
				}
			}
		)
	)

	return { foldedStarts: () => foldedStarts, toggleFold }
}
