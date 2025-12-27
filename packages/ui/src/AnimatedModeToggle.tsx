import { useColorMode } from '@kobalte/core'
import { ModeToggle, type ModeToggleProps } from './ModeToggle'

const ANIMATION_DURATION = 400

export type AnimatedModeToggleProps = Omit<ModeToggleProps, 'onClick' | 'ref'>

export const AnimatedModeToggle = (props: AnimatedModeToggleProps) => {
	const { toggleColorMode } = useColorMode()
	let buttonRef: HTMLButtonElement | undefined

	const handleClick = async () => {
		if (!buttonRef) return

		// Check for View Transitions API support
		if (!document.startViewTransition) {
			toggleColorMode()
			return
		}

		// Add class to scope CSS and disable CSS transitions during capture
		document.documentElement.classList.add('theme-transitioning')
		const style = document.createElement('style')
		style.innerHTML = '* { transition: none !important; }'
		document.head.appendChild(style)

		const transition = document.startViewTransition(() => {
			toggleColorMode()
		})

		try {
			await transition.ready

			// Clean up after snapshot
			style.remove()

			// Get button's center position
			const { top, left, width, height } = buttonRef.getBoundingClientRect()
			const x = left + width / 2
			const y = top + height / 2

			// Calculate max radius to cover entire screen
			const maxRadius = Math.hypot(
				Math.max(left, window.innerWidth - left),
				Math.max(top, window.innerHeight - top)
			)

			// Animate the new view with expanding circle
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${maxRadius}px at ${x}px ${y}px)`,
					],
				},
				{
					duration: ANIMATION_DURATION,
					easing: 'ease-in-out',
					pseudoElement: '::view-transition-new(root)',
				}
			)

			// Wait for the entire view transition to complete before cleanup
			await transition.finished
			document.documentElement.classList.remove('theme-transitioning')
		} catch {
			// Transition was skipped, clean up
			style.remove()
			document.documentElement.classList.remove('theme-transitioning')
		}
	}

	return (
		<ModeToggle
			ref={(el) => (buttonRef = el)}
			onClick={handleClick}
			class={props.class}
		/>
	)
}
