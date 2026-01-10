import { createEffect, createSignal, type Accessor } from 'solid-js'

type UseTreeNodeHoverProps = {
	isOpen: Accessor<boolean>
	onHover?: (hovered: boolean) => void
}

export function useTreeNodeHover(props: UseTreeNodeHoverProps) {
	const [isHovered, setIsHovered] = createSignal(false)
	const [childHoverCount, setChildHoverCount] = createSignal(0)

	const showBranchLine = () => isHovered() || childHoverCount() > 0

	const handleRowHover = (hovered: boolean) => {
		setIsHovered(hovered)
	}

	const handleChildHover = (hovered: boolean) => {
		setChildHoverCount((c) => c + (hovered ? 1 : -1))
	}

	let lastContributed = false
	createEffect(() => {
		const contributes = isHovered() && !props.isOpen()
		if (contributes !== lastContributed) {
			lastContributed = contributes
			props.onHover?.(contributes)
		}
	})

	return {
		isHovered,
		showBranchLine,
		handleRowHover,
		handleChildHover,
	}
}
