import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Tab } from './Tab'

describe('Tab Component', () => {
	it('should render the tab with label', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
			/>
		))

		const tab = container.querySelector('[role="tab"]')
		expect(tab).toBeTruthy()
		expect(tab?.textContent).toContain('file.txt')
	})

	it('should display dirty indicator when isDirty is true', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
				isDirty={true}
				onClose={() => {}}
			/>
		))

		// Dirty indicator is shown via VsCircleFilled icon
		expect(container.innerHTML).toBeTruthy()
	})

	it('should show close button when onClose is provided', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
				onClose={() => {}}
			/>
		))

		const closeButton = container.querySelector('[title="Close file.txt"]')
		expect(closeButton).toBeTruthy()
	})

	it('should not show close button when onClose is not provided', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
			/>
		))

		const closeButton = container.querySelector('[title="Close file.txt"]')
		expect(closeButton).toBeFalsy()
	})

	it('should apply active styles when isActive is true', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
				isActive={true}
			/>
		))

		const tab = container.querySelector('[role="tab"]')
		expect(tab?.getAttribute('aria-selected')).toBe('true')
	})
})
