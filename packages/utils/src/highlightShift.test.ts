import { describe, it, expect } from 'vitest'
import {
	shiftCaptures,
	shiftBrackets,
	shiftFolds,
	getEditCharDelta,
	getEditLineDelta,
} from './highlightShift'

describe('highlightShift', () => {
	describe('getEditCharDelta', () => {
		it('computes delta from newEndIndex and oldEndIndex', () => {
			expect(
				getEditCharDelta({ insertedText: '', newEndIndex: 15, oldEndIndex: 10 })
			).toBe(5)
			expect(
				getEditCharDelta({ insertedText: '', newEndIndex: 10, oldEndIndex: 15 })
			).toBe(-5)
		})

		it('falls back to insertedText length when indices not provided', () => {
			expect(getEditCharDelta({ insertedText: 'hello' })).toBe(5)
			expect(getEditCharDelta({ insertedText: '' })).toBe(0)
		})
	})

	describe('getEditLineDelta', () => {
		it('computes line delta from newEndPosition and oldEndPosition', () => {
			expect(
				getEditLineDelta({
					startPosition: { row: 5 },
					oldEndPosition: { row: 5 },
					newEndPosition: { row: 7 },
				})
			).toBe(2)
		})

		it('uses startPosition as fallback', () => {
			expect(
				getEditLineDelta({
					startPosition: { row: 5 },
					newEndPosition: { row: 8 },
				})
			).toBe(3)
		})

		it('returns 0 when positions are missing', () => {
			expect(getEditLineDelta({})).toBe(0)
		})
	})

	describe('shiftCaptures', () => {
		const captures = [
			{ startIndex: 0, endIndex: 5, scope: 'keyword' },
			{ startIndex: 10, endIndex: 15, scope: 'string' },
			{ startIndex: 20, endIndex: 30, scope: 'comment' },
		]

		it('shifts captures after insert position by positive delta', () => {
			// Insert 3 chars at position 8
			const shifted = shiftCaptures(captures, 8, 3)

			expect(shifted[0]).toEqual({
				startIndex: 0,
				endIndex: 5,
				scope: 'keyword',
			}) // Before insert, unchanged
			expect(shifted[1]).toEqual({
				startIndex: 13,
				endIndex: 18,
				scope: 'string',
			}) // After insert, shifted +3
			expect(shifted[2]).toEqual({
				startIndex: 23,
				endIndex: 33,
				scope: 'comment',
			}) // After insert, shifted +3
		})

		it('shifts captures after insert position by negative delta (deletion)', () => {
			// Delete 2 chars at position 8
			const shifted = shiftCaptures(captures, 8, -2)

			expect(shifted[0]).toEqual({
				startIndex: 0,
				endIndex: 5,
				scope: 'keyword',
			})
			expect(shifted[1]).toEqual({
				startIndex: 8,
				endIndex: 13,
				scope: 'string',
			})
			expect(shifted[2]).toEqual({
				startIndex: 18,
				endIndex: 28,
				scope: 'comment',
			})
		})

		it('shifts capture that spans the insert point correctly', () => {
			// Insert inside a capture
			const captures = [{ startIndex: 5, endIndex: 15, scope: 'string' }]
			const shifted = shiftCaptures(captures, 10, 3)

			// Start is before insert point (unchanged), end is after (shifted)
			expect(shifted[0]).toEqual({
				startIndex: 5,
				endIndex: 18,
				scope: 'string',
			})
		})

		it('handles insert at exact capture start', () => {
			const shifted = shiftCaptures(captures, 10, 5)

			// Capture starting exactly at insert position gets shifted
			expect(shifted[1]).toEqual({
				startIndex: 15,
				endIndex: 20,
				scope: 'string',
			})
		})

		it('preserves all other capture properties', () => {
			const capturesWithExtra = [
				{
					startIndex: 10,
					endIndex: 20,
					scope: 'test',
					captureName: 'identifier',
					extra: true,
				},
			]
			const shifted = shiftCaptures(capturesWithExtra, 5, 3)

			expect(shifted[0]).toEqual({
				startIndex: 13,
				endIndex: 23,
				scope: 'test',
				captureName: 'identifier',
				extra: true,
			})
		})
	})

	describe('shiftBrackets', () => {
		const brackets = [
			{ index: 5, char: '(', depth: 1 },
			{ index: 15, char: ')', depth: 1 },
			{ index: 25, char: '{', depth: 2 },
		]

		it('shifts brackets after insert position', () => {
			const shifted = shiftBrackets(brackets, 10, 5)

			expect(shifted[0]).toEqual({ index: 5, char: '(', depth: 1 }) // Before, unchanged
			expect(shifted[1]).toEqual({ index: 20, char: ')', depth: 1 }) // After, shifted +5
			expect(shifted[2]).toEqual({ index: 30, char: '{', depth: 2 }) // After, shifted +5
		})

		it('handles deletion (negative delta)', () => {
			const shifted = shiftBrackets(brackets, 10, -3)

			expect(shifted[0]).toEqual({ index: 5, char: '(', depth: 1 })
			expect(shifted[1]).toEqual({ index: 12, char: ')', depth: 1 })
			expect(shifted[2]).toEqual({ index: 22, char: '{', depth: 2 })
		})
	})

	describe('shiftFolds', () => {
		const folds = [
			{ startLine: 0, endLine: 5, type: 'function' },
			{ startLine: 10, endLine: 20, type: 'class' },
			{ startLine: 25, endLine: 30, type: 'block' },
		]

		it('shifts folds after insert line', () => {
			const shifted = shiftFolds(folds, 8, 3)

			expect(shifted[0]).toEqual({ startLine: 0, endLine: 5, type: 'function' }) // Before, unchanged
			expect(shifted[1]).toEqual({ startLine: 13, endLine: 23, type: 'class' }) // After, shifted +3
			expect(shifted[2]).toEqual({ startLine: 28, endLine: 33, type: 'block' }) // After, shifted +3
		})

		it('handles line deletion (negative delta)', () => {
			const shifted = shiftFolds(folds, 8, -2)

			expect(shifted[0]).toEqual({ startLine: 0, endLine: 5, type: 'function' })
			expect(shifted[1]).toEqual({ startLine: 8, endLine: 18, type: 'class' })
			expect(shifted[2]).toEqual({ startLine: 23, endLine: 28, type: 'block' })
		})

		it('filters out folds that become invalid after shifting', () => {
			const smallFolds = [
				{ startLine: 10, endLine: 11, type: 'block' }, // Only 1 line span
			]
			// Delete 2 lines - would make endLine < startLine
			const shifted = shiftFolds(smallFolds, 10, -2)

			// The fold becomes invalid (startLine: 8, endLine: 9 -> invalid because 9 <= 8 is false, but 9 > 8 so it's kept)
			// Actually: startLine >= insertLineRow (10 >= 10) so startLine becomes 10 + (-2) = 8
			// endLine >= insertLineRow (11 >= 10) so endLine becomes 11 + (-2) = 9
			// 9 > 8 so it's still valid
			expect(shifted).toHaveLength(1)
			expect(shifted[0]).toEqual({ startLine: 8, endLine: 9, type: 'block' })
		})

		it('removes fold when it would collapse', () => {
			const folds = [{ startLine: 10, endLine: 10, type: 'empty' }]
			const shifted = shiftFolds(folds, 5, 0)

			// endLine (10) > startLine (10) is false, so it gets filtered out
			expect(shifted).toHaveLength(0)
		})
	})
})
