import { Accessor, createEffect, createSignal, onCleanup } from 'solid-js'

export enum AutoHideMode {
	SHOW = 'SHOW',
	HIDE = 'HIDE',
	AUTO = 'AUTO',
}

export function useAutoHide(
	el: Accessor<HTMLElement | null>,
	mode: Accessor<AutoHideMode>
) {
	const [isHovering, setIsHovering] = createSignal(false)

	createEffect(() => {
		const element = el()
		if (!element) return

		let rect = element.getBoundingClientRect()
		element.classList.add('transition-display')

		const onMouseMove = (event: MouseEvent) => {
			const newRect = element.getBoundingClientRect()
			if (newRect.width) rect = newRect

			const isOver =
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom

			setIsHovering(isOver)
		}

		window.addEventListener('mousemove', onMouseMove)
		onCleanup(() => window.removeEventListener('mousemove', onMouseMove))
	})

	createEffect(() => {
		const element = el()
		const currentMode = mode()
		const hovering = isHovering()

		if (!element) return

		const shouldShow =
			currentMode === AutoHideMode.SHOW ||
			(currentMode === AutoHideMode.AUTO && hovering)

		if (shouldShow) {
			element.style.display = 'block'
			requestAnimationFrame(() => {
				element.style.opacity = '1'
			})
		} else {
			element.style.opacity = '0'
			element.style.display = 'none'
		}
	})
}
