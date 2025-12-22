/**
 * Utilities for calculating dynamic gutter width based on line count and gutter mode.
 */

import type { GutterMode } from '../consts'

// Padding around line number: left padding (EDITOR_PADDING_LEFT=12) + fold button width (16) + small gap
const GUTTER_PADDING = 28 // px for fold button and spacing

/**
 * Convert a number to a specific numeral system string.
 * Used to calculate the width of the longest line number.
 */
const toNumeralString = (n: number, mode: GutterMode): string => {
	switch (mode) {
		case 'decimal':
			return String(n)
		case 'decimal-leading-zero':
			// For leading zeros, we need to know the total count, but for width
			// estimation we can just use the number of digits
			return String(n)
		case 'lower-roman':
			return toRoman(n).toLowerCase()
		case 'upper-roman':
			return toRoman(n)
		case 'lower-alpha':
			return toAlpha(n).toLowerCase()
		case 'upper-alpha':
			return toAlpha(n)
		case 'lower-greek':
			return toGreek(n)
		case 'hebrew':
			return toHebrew(n)
		case 'hiragana':
			return toHiragana(n)
		case 'katakana':
			return toKatakana(n)
		case 'cjk-ideographic':
			return toCJK(n)
		default:
			return String(n)
	}
}

/**
 * Convert number to Roman numerals
 */
const toRoman = (n: number): string => {
	if (n < 1 || n > 3999) return String(n)

	const lookup: [number, string][] = [
		[1000, 'M'],
		[900, 'CM'],
		[500, 'D'],
		[400, 'CD'],
		[100, 'C'],
		[90, 'XC'],
		[50, 'L'],
		[40, 'XL'],
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I'],
	]

	let result = ''
	let num = n
	for (const [value, symbol] of lookup) {
		while (num >= value) {
			result += symbol
			num -= value
		}
	}
	return result
}

/**
 * Convert number to alphabetic (A, B, C, ... Z, AA, AB, ...)
 */
const toAlpha = (n: number): string => {
	let result = ''
	let num = n
	while (num > 0) {
		num--
		result = String.fromCharCode(65 + (num % 26)) + result
		num = Math.floor(num / 26)
	}
	return result
}

/**
 * Greek alphabet for lower-greek
 */
const GREEK_LETTERS = 'αβγδεζηθικλμνξοπρστυφχψω'

const toGreek = (n: number): string => {
	if (n < 1) return String(n)
	// Greek uses additive system for small numbers
	let result = ''
	let num = n
	while (num > 0) {
		const idx = (num - 1) % 24
		result = GREEK_LETTERS[idx] + result
		num = Math.floor((num - 1) / 24)
		if (num === 0) break
	}
	return result || GREEK_LETTERS[0]!
}

/**
 * Hebrew numerals (Gematria)
 */
const HEBREW_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const HEBREW_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HEBREW_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק']

const toHebrew = (n: number): string => {
	if (n < 1) return String(n)
	if (n >= 1000) return String(n) // Fallback for very large numbers

	let result = ''
	const hundreds = Math.floor(n / 100)
	const tens = Math.floor((n % 100) / 10)
	const ones = n % 10

	result += HEBREW_HUNDREDS[hundreds] || ''
	result += HEBREW_TENS[tens] || ''
	result += HEBREW_ONES[ones] || ''

	return result
}

/**
 * Hiragana numerals (iroha order or simple あいうえお sequence)
 */
const HIRAGANA =
	'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'

const toHiragana = (n: number): string => {
	if (n < 1) return String(n)
	let result = ''
	let num = n
	while (num > 0) {
		num--
		result = HIRAGANA[num % HIRAGANA.length] + result
		num = Math.floor(num / HIRAGANA.length)
		if (num === 0) break
	}
	return result || HIRAGANA[0]!
}

/**
 * Katakana numerals
 */
const KATAKANA =
	'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'

const toKatakana = (n: number): string => {
	if (n < 1) return String(n)
	let result = ''
	let num = n
	while (num > 0) {
		num--
		result = KATAKANA[num % KATAKANA.length] + result
		num = Math.floor(num / KATAKANA.length)
		if (num === 0) break
	}
	return result || KATAKANA[0]!
}

/**
 * CJK Ideographic numerals
 */
const toCJK = (n: number): string => {
	if (n === 0) return '零'
	if (n < 1) return String(n)

	const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
	const units = ['', '十', '百', '千']

	if (n < 10) return digits[n]!
	if (n >= 10000) return String(n) // Fallback for very large numbers

	let result = ''
	let num = n
	let unitIdx = 0

	while (num > 0) {
		const digit = num % 10
		if (digit !== 0) {
			result = digits[digit]! + units[unitIdx]! + result
		}
		num = Math.floor(num / 10)
		unitIdx++
	}

	// Clean up leading 一 for 十
	if (result.startsWith('一十')) {
		result = result.slice(1)
	}

	return result
}

/**
 * Measure the pixel width of a string using a temporary element.
 */
const measureTextWidth = (
	text: string,
	fontSize: number,
	fontFamily: string
): number => {
	const canvas = document.createElement('canvas')
	const ctx = canvas.getContext('2d')
	if (!ctx) return text.length * fontSize * 0.6 // Fallback estimate

	ctx.font = `${fontSize}px ${fontFamily}`
	return ctx.measureText(text).width
}

/**
 * Calculate the minimum gutter width needed for a given line count and mode.
 */
export const calculateGutterWidth = (
	lineCount: number,
	mode: GutterMode,
	fontSize: number,
	fontFamily: string
): number => {
	if (lineCount === 0) return GUTTER_PADDING + fontSize // Minimum width

	// Get the string representation of the largest line number
	const maxLineStr = toNumeralString(lineCount, mode)

	// Measure the width
	const textWidth = measureTextWidth(maxLineStr, fontSize, fontFamily)

	// Add padding for fold button and spacing
	return Math.ceil(textWidth + GUTTER_PADDING)
}

export { toNumeralString }
