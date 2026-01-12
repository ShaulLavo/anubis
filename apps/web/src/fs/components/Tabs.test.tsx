import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Tabs } from './Tabs'

describe('Tabs Component', () => {
	it('should display basic tooltip', () => {
		const getTooltip = (value: string) => `/path/to/${value}`

		const { container } = render(() => (
			<Tabs
				values={['file.txt']}
				getTooltip={getTooltip}
			/>
		))

		const tab = container.querySelector('[role="tab"]')
		expect(tab?.getAttribute('title')).toBe('/path/to/file.txt')
	})

	it('should use value as fallback when no tooltip function provided', () => {
		const { container } = render(() => (
			<Tabs
				values={['file.txt']}
			/>
		))

		const tab = container.querySelector('[role="tab"]')
		expect(tab?.getAttribute('title')).toBe('file.txt')
	})

	it('should render multiple tabs', () => {
		const { container } = render(() => (
			<Tabs
				values={['file1.txt', 'file2.txt', 'file3.txt']}
			/>
		))

		const tabs = container.querySelectorAll('[role="tab"]')
		expect(tabs.length).toBe(3)
	})
})
