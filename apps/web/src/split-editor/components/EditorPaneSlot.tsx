/**
 * EditorPaneSlot Component
 *
 * Renders the slot where pane portal content will be mounted.
 * Includes TabBar for tab management and handles focus.
 */

import { createMemo, Show } from 'solid-js'
import { useLayoutManager } from './SplitEditor'
import { TabBar } from './TabBar'
import { CONTAINMENT_MODE } from '../constants'
import type { EditorPane } from '../types'
import { isPane } from '../types'

export interface EditorPaneSlotProps {
	pane: EditorPane
}

export function EditorPaneSlot(props: EditorPaneSlotProps) {
	const layout = useLayoutManager()

	const isFocused = createMemo(
		() => layout.state.focusedPaneId === props.pane.id
	)

	// Track tabs reactively from the store
	const hasTabs = createMemo(() => {
		const pane = layout.state.nodes[props.pane.id]
		return pane && isPane(pane) && pane.tabs.length > 0
	})

	const handleClick = () => {
		layout.setFocusedPane(props.pane.id)
	}

	return (
		<div
			class="editor-pane-slot relative flex h-full w-full flex-col transition-all duration-200 ease-in-out"
			classList={{
				'ring-2 ring-primary/60 ring-inset shadow-sm bg-background': isFocused(),
				'ring-1 ring-border/30 ring-inset bg-background/50': !isFocused(),
			}}
			onClick={handleClick}
			data-pane-id={props.pane.id}
			style={{ contain: CONTAINMENT_MODE }}
		>
			<Show when={hasTabs()}>
				<TabBar paneId={props.pane.id} />
			</Show>
			<div
				id={`pane-target-${props.pane.id}`}
				class="relative min-h-0 flex-1 overflow-hidden"
			/>
		</div>
	)
}
