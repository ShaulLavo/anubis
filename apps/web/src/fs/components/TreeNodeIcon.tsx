import { Show } from 'solid-js'
import { VsChevronDown } from '@repo/icons/vs/VsChevronDown'
import { VsChevronRight } from '@repo/icons/vs/VsChevronRight'
import { FileIcon } from './FileIcon'

type TreeNodeIconProps = {
	isDir: boolean
	isOpen: boolean
	name: string
	isSelected: boolean
}

export const TreeNodeIcon = (props: TreeNodeIconProps) => {
	return (
		<span
			class="tree-node-icon"
			classList={{ 'text-cyan-700': props.isSelected }}
		>
			<Show
				when={props.isDir}
				fallback={<FileIcon name={props.name} size={16} />}
			>
				<Show when={props.isOpen} fallback={<VsChevronRight size={16} />}>
					<VsChevronDown size={16} />
				</Show>
			</Show>
		</span>
	)
}
