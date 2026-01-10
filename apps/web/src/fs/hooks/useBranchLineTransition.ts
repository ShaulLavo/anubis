import { createEffect, createSignal, type Accessor } from 'solid-js'
import { createSwitchTransition } from '@solid-primitives/transition-group'

type UseBranchLineTransitionProps = {
	isOpen: Accessor<boolean>
	showBranchLine: Accessor<boolean>
}

export function useBranchLineTransition(props: UseBranchLineTransitionProps) {
	const [branchLineRef, setBranchLineRef] = createSignal<HTMLSpanElement>()

	const branchLineEl = () => (props.isOpen() ? branchLineRef() : undefined)

	createSwitchTransition(branchLineEl, {
		onEnter(el, done) {
			el.style.opacity = '0'
			requestAnimationFrame(() => {
				el.style.transition = 'opacity 200ms ease-out'
				el.style.opacity = props.showBranchLine() ? '0.4' : '0'
				el.addEventListener('transitionend', done, { once: true })
			})
		},
		onExit(el, done) {
			el.style.transition = 'opacity 200ms ease-out'
			el.style.opacity = '0'
			el.addEventListener('transitionend', done, { once: true })
		},
	})

	createEffect(() => {
		const el = branchLineRef()
		if (el && props.isOpen()) {
			el.style.opacity = props.showBranchLine() ? '0.4' : '0'
		}
	})

	return {
		branchLineRef,
		setBranchLineRef,
	}
}
