import { describe, expect, it } from 'vitest'
import {
	computeTotalHeight2D,
	computeVisibleRange2D,
	computeColumnRange,
	VIRTUALIZATION_THRESHOLD,
} from './create2DVirtualizer'

// ============================================================================
// Unit Tests for 2D Virtualizer Pure Functions
// ============================================================================

describe('computeTotalHeight2D', () => {
	it('returns 0 for empty list', () => {
		expect(computeTotalHeight2D(0, 20)).toBe(0)
	})

	it('computes total size correctly', () => {
		expect(computeTotalHeight2D(10, 20)).toBe(200)
		expect(computeTotalHeight2D(100, 16)).toBe(1600)
	})

	it('handles edge cases gracefully', () => {
		expect(computeTotalHeight2D(-1, 20)).toBe(0) // negative count
		expect(computeTotalHeight2D(10, 0)).toBe(10) // zero height → normalizes to 1
		expect(computeTotalHeight2D(NaN, 20)).toBe(0) // NaN count
	})
})

describe('computeVisibleRange2D', () => {
	it('returns zeros when disabled', () => {
		const range = computeVisibleRange2D({
			enabled: false,
			count: 100,
			rowHeight: 20,
			charWidth: 8,
			scrollTop: 0,
			scrollLeft: 0,
			viewportHeight: 500,
			viewportWidth: 800,
		})
		expect(range).toEqual({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 0 })
	})

	it('returns zeros for empty list', () => {
		const range = computeVisibleRange2D({
			enabled: true,
			count: 0,
			rowHeight: 20,
			charWidth: 8,
			scrollTop: 0,
			scrollLeft: 0,
			viewportHeight: 500,
			viewportWidth: 800,
		})
		expect(range).toEqual({ rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 0 })
	})

	it('computes vertical range correctly at top', () => {
		const range = computeVisibleRange2D({
			enabled: true,
			count: 100,
			rowHeight: 20,
			charWidth: 8,
			scrollTop: 0,
			scrollLeft: 0,
			viewportHeight: 100,
			viewportWidth: 800,
		})
		expect(range.rowStart).toBe(0)
		expect(range.rowEnd).toBe(5) // ceil((100 + 20 - 1) / 20) = 6, so end = 5
	})

	it('computes vertical range correctly in middle', () => {
		const range = computeVisibleRange2D({
			enabled: true,
			count: 100,
			rowHeight: 20,
			charWidth: 8,
			scrollTop: 200, // row 10
			scrollLeft: 0,
			viewportHeight: 100,
			viewportWidth: 800,
		})
		expect(range.rowStart).toBe(10)
		expect(range.rowEnd).toBe(15)
	})

	it('computes horizontal range correctly', () => {
		const range = computeVisibleRange2D({
			enabled: true,
			count: 100,
			rowHeight: 20,
			charWidth: 10, // easy math
			scrollTop: 0,
			scrollLeft: 50, // 5 chars
			viewportHeight: 100,
			viewportWidth: 200, // 20 chars
		})
		expect(range.colStart).toBe(5)
		expect(range.colEnd).toBe(25) // 5 + 20
	})

	it('clamps to end of list', () => {
		const range = computeVisibleRange2D({
			enabled: true,
			count: 50,
			rowHeight: 20,
			charWidth: 8,
			scrollTop: 900, // row 45
			scrollLeft: 0,
			viewportHeight: 200, // 10 rows
			viewportWidth: 800,
		})
		expect(range.rowStart).toBe(45)
		expect(range.rowEnd).toBe(49) // clamped to count - 1
	})
})

// ============================================================================
// Threshold Behavior Tests
// ============================================================================

describe('computeColumnRange (threshold behavior)', () => {
	const defaultOptions = {
		scrollLeft: 0,
		viewportWidth: 800,
		charWidth: 8,
		horizontalOverscan: 20,
	}

	describe('short lines (no horizontal virtualization)', () => {
		it('renders full line when length < threshold', () => {
			const result = computeColumnRange({
				...defaultOptions,
				lineLength: 100,
			})
			expect(result).toEqual({ columnStart: 0, columnEnd: 100 })
		})

		it('renders full line when length = threshold', () => {
			const result = computeColumnRange({
				...defaultOptions,
				lineLength: VIRTUALIZATION_THRESHOLD,
			})
			expect(result).toEqual({
				columnStart: 0,
				columnEnd: VIRTUALIZATION_THRESHOLD,
			})
		})

		it('renders full short line even when scrolled horizontally', () => {
			const result = computeColumnRange({
				...defaultOptions,
				scrollLeft: 1000,
				lineLength: 200,
			})
			// Short lines always render fully regardless of scroll
			expect(result).toEqual({ columnStart: 0, columnEnd: 200 })
		})
	})

	describe('long lines (horizontal virtualization applies)', () => {
		const longLine = VIRTUALIZATION_THRESHOLD + 500 // 1000 chars

		it('virtualizes long lines when scrolled to start', () => {
			const result = computeColumnRange({
				...defaultOptions,
				scrollLeft: 0,
				lineLength: longLine,
			})
			// colStartBase = 0, visible = 800/8 = 100
			// hStart = max(0, 0 - 20) = 0
			// hEnd = min(1000, 0 + 100 + 20) = 120
			expect(result.columnStart).toBe(0)
			expect(result.columnEnd).toBe(120)
		})

		it('virtualizes long lines when scrolled to middle', () => {
			const result = computeColumnRange({
				...defaultOptions,
				scrollLeft: 400, // char 50
				lineLength: longLine,
			})
			// colStartBase = 400/8 = 50, visible = 100
			// hStart = max(0, 50 - 20) = 30
			// hEnd = min(1000, 50 + 100 + 20) = 170
			expect(result.columnStart).toBe(30)
			expect(result.columnEnd).toBe(170)
		})

		it('clamps to line length when near end', () => {
			const result = computeColumnRange({
				...defaultOptions,
				scrollLeft: 7800, // char 975
				lineLength: longLine,
			})
			// colStartBase = 7800/8 = 975
			// hStart = max(0, 975 - 20) = 955
			// hEnd = min(1000, 975 + 100 + 20) = 1000
			expect(result.columnStart).toBe(955)
			expect(result.columnEnd).toBe(1000)
		})

		it('returns empty range when scrolled past line end', () => {
			const result = computeColumnRange({
				...defaultOptions,
				scrollLeft: 10000, // way past line
				lineLength: longLine,
			})
			// hStart >= lineLength, so return empty
			expect(result).toEqual({ columnStart: 0, columnEnd: 0 })
		})
	})

	describe('edge cases', () => {
		it('handles zero-width viewport', () => {
			const result = computeColumnRange({
				...defaultOptions,
				viewportWidth: 0,
				lineLength: VIRTUALIZATION_THRESHOLD + 100,
			})
			// visibleCols = max(1, 0/8) = 1
			// hEnd = min(600, 0 + 1 + 20) = 21
			expect(result.columnStart).toBe(0)
			expect(result.columnEnd).toBe(21)
		})

		it('handles very large overscan', () => {
			const result = computeColumnRange({
				scrollLeft: 0,
				viewportWidth: 100, // 12-13 chars
				charWidth: 8,
				horizontalOverscan: 1000,
				lineLength: VIRTUALIZATION_THRESHOLD + 100,
			})
			// Overscan can't exceed line length
			expect(result.columnEnd).toBe(600) // lineLength
		})
	})
})

// ============================================================================
// Threshold constant verification
// ============================================================================

describe('VIRTUALIZATION_THRESHOLD', () => {
	it('is set to 500', () => {
		expect(VIRTUALIZATION_THRESHOLD).toBe(500)
	})

	it('boundary behavior: 500 chars = no virtualization', () => {
		const result = computeColumnRange({
			scrollLeft: 1000,
			viewportWidth: 100,
			charWidth: 8,
			horizontalOverscan: 20,
			lineLength: 500,
		})
		expect(result).toEqual({ columnStart: 0, columnEnd: 500 })
	})

	it('boundary behavior: 501 chars = virtualization applies', () => {
		const result = computeColumnRange({
			scrollLeft: 0,
			viewportWidth: 100,
			charWidth: 8,
			horizontalOverscan: 20,
			lineLength: 501,
		})
		// Should slice since > 500
		expect(result.columnEnd).toBeLessThan(501)
	})
})
