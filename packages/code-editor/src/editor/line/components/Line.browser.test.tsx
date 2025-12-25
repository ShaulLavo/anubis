import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-solid'
import { Line } from './Line'

const { mockedWarn } = vi.hoisted(() => {
	return { mockedWarn: vi.fn() }
})

vi.mock('@repo/logger', () => ({
	loggers: {
		codeEditor: {
			withTag: () => ({
				warn: mockedWarn,
			}),
		},
	},
}))

describe('Line', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		mockedWarn.mockClear()
	})

	it('bails out when columnEnd is before columnStart', () => {
		const screen = render(() => (
			<Line
				virtualRow={{
					index: 0,
					start: 0,
					size: 20,
					columnStart: 8,
					columnEnd: 4,
				}}
				lineIndex={0}
				lineText="Hello, world"
				lineHeight={20}
				contentWidth={200}
				charWidth={8}
				tabSize={2}
				isEditable={() => true}
				onPreciseClick={() => {}}
				isActive={false}
			/>
		))

		expect(screen.container.textContent).toBe('')
		expect(mockedWarn).toHaveBeenCalledWith(
			'Line virtual row column range is invalid',
			expect.objectContaining({
				lineIndex: 0,
				columnStart: 8,
				columnEnd: 4,
			})
		)
	})
})
