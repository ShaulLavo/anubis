import { describe, expect, it } from 'vitest'
import { scanLineWidthSlice } from './createTextEditorLayout'

describe('scanLineWidthSlice', () => {
	it('slices work and resumes', () => {
		const lines = ['a', 'bb', 'ccc', 'dddd', 'eeeee']
		let calls = 0
		const getLineText = (lineIndex: number) => {
			calls += 1
			return lines[lineIndex] ?? ''
		}

		const first = scanLineWidthSlice({
			startIndex: 0,
			endIndex: 4,
			nextIndex: 0,
			maxColumns: 0,
			tabSize: 4,
			getLineText,
			shouldYield: () => calls >= 2,
		})

		expect(first.linesProcessed).toBe(2)
		expect(first.done).toBe(false)
		expect(first.nextIndex).toBe(2)
		expect(first.maxColumns).toBe(2)

		calls = 0
		const second = scanLineWidthSlice({
			startIndex: 0,
			endIndex: 4,
			nextIndex: first.nextIndex,
			maxColumns: first.maxColumns,
			tabSize: 4,
			getLineText,
			shouldYield: () => false,
		})

		expect(second.done).toBe(true)
		expect(second.maxColumns).toBe(5)
	})

	it('makes progress when budget is exhausted', () => {
		const lines = ['\t', 'a\tb']
		const getLineText = (lineIndex: number) => lines[lineIndex] ?? ''

		const result = scanLineWidthSlice({
			startIndex: 0,
			endIndex: 1,
			nextIndex: 0,
			maxColumns: 0,
			tabSize: 4,
			getLineText,
			shouldYield: () => true,
		})

		expect(result.linesProcessed).toBe(1)
		expect(result.done).toBe(false)
		expect(result.maxColumns).toBe(4)
	})
})
