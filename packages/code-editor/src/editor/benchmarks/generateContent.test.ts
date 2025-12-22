import { describe, expect, it } from 'vitest'
import { generateContent, generatePresetContent } from './generateContent'

describe('generateContent', () => {
	it('throws when charsPerLine is too small for line numbers', () => {
		expect(() =>
			generateContent({
				lines: 120,
				charsPerLine: 4,
				includeLineNumbers: true,
			})
		).toThrowError(/charsPerLine/i)
	})

	it('throws when charsPerLine is less than 1', () => {
		expect(() =>
			generateContent({
				lines: 10,
				charsPerLine: 0,
				includeLineNumbers: false,
			})
		).toThrowError(/charsPerLine/i)
	})

	it('generates correct number of lines', () => {
		const lines = 10
		const content = generateContent({
			lines,
			charsPerLine: 20,
			includeLineNumbers: false,
		})
		expect(content.split('\n')).toHaveLength(lines)
	})

	it('produces deterministic output', () => {
		const options = {
			lines: 5,
			charsPerLine: 20,
			includeLineNumbers: true,
		}
		const content1 = generateContent(options)
		const content2 = generateContent(options)
		expect(content1).toBe(content2)
	})

	it('formats line numbers correctly', () => {
		const content = generateContent({
			lines: 10,
			charsPerLine: 20,
			includeLineNumbers: true,
		})
		const lines = content.split('\n')
		expect(lines[0]).toMatch(/^01: /)
		expect(lines[9]).toMatch(/^10: /)
	})

	it('generates content from presets', () => {
		const content = generatePresetContent('small')
		expect(content.split('\n')).toHaveLength(100)
		expect(content.length).toBeGreaterThan(0)
	})
})
