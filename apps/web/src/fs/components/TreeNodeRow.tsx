import type { JSX } from 'solid-js'
import { createRowIndentStyle } from '../utils/treeNodeUtils'

type TreeNodeRowProps = {
	depth: number
	indentationOffset: number
	isSelected: boolean
	onMouseEnter: () => void
	onMouseLeave: () => void
	children: JSX.Element
}

export const TreeNodeRow = (props: TreeNodeRowProps) => {
	return (
		<div
			class="relative group"
			style={createRowIndentStyle(props.depth)}
			onMouseEnter={() => props.onMouseEnter()}
			onMouseLeave={() => props.onMouseLeave()}
		>
			<span
				aria-hidden="true"
				class="tree-node-row-highlight"
				style={{ left: `-${props.indentationOffset}px` }}
				classList={{
					'border-cyan-700': props.isSelected,
					'border-transparent': !props.isSelected,
					'group-hover:bg-foreground/10': !props.isSelected,
				}}
			/>
			{props.children}
		</div>
	)
}
