/**
 * TabBar Component
 *
 * Renders horizontal list of tabs with horizontal scroll support for overflow.
 * Requirements: 7.8, 15.6
 */

import { createMemo, For } from 'solid-js'
import { useLayoutManager } from './SplitEditor'
import { TabItem } from './TabItem'
import { isPane } from '../types'

export interface TabBarProps {
	paneId: string
}

export function TabBar(props: TabBarProps) {
	const layout = useLayoutManager()
	
	// Get pane reactively from store
	const pane = createMemo(() => {
		const node = layout.state.nodes[props.paneId]
		return node && isPane(node) ? node : null
	})
	
	const tabs = createMemo(() => pane()?.tabs ?? [])
	const activeTabId = createMemo(() => pane()?.activeTabId ?? null)

	return (
		<div class="tab-bar flex h-9 shrink-0 overflow-x-auto border-b border-border bg-surface-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-surface-3">
			<For each={tabs()}>
				{(tab) => (
					<TabItem
						tab={tab}
						paneId={props.paneId}
						isActive={activeTabId() === tab.id}
					/>
				)}
			</For>
		</div>
	)
}