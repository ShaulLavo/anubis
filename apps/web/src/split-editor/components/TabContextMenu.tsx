/**
 * TabContextMenu Component
 *
 * Right-click context menu for tabs with common actions:
 * - Close tab
 * - Close other tabs
 * - Close all tabs
 * - Reveal in file tree
 * - Copy file path
 * - Split to new pane
 *
 * Requirements: 9.4
 */

import { createSignal, Show, onCleanup, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { toast } from '@repo/ui/toaster'
import { useLayoutManager } from './SplitEditor'
import { isPane } from '../types'
import type { Tab, EditorPane } from '../types'

export interface TabContextMenuProps {
	tab: Tab
	paneId: string
	children: (props: { onContextMenu: (e: MouseEvent) => void }) => JSX.Element
}

export interface TabContextMenuState {
	isOpen: boolean
	position: { x: number; y: number }
}

export function TabContextMenu(props: TabContextMenuProps) {
	const layout = useLayoutManager()
	const [menuState, setMenuState] = createSignal<TabContextMenuState>({
		isOpen: false,
		position: { x: 0, y: 0 },
	})

	let menuRef: HTMLDivElement | undefined

	const handleClickOutside = (e: MouseEvent) => {
		if (menuRef && !menuRef.contains(e.target as Node)) {
			closeMenu()
		}
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeMenu()
		}
	}

	const openMenu = (e: MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setMenuState({
			isOpen: true,
			position: { x: e.clientX, y: e.clientY },
		})

		document.addEventListener('click', handleClickOutside)
		document.addEventListener('keydown', handleKeyDown)
	}

	const closeMenu = () => {
		setMenuState((prev) => ({ ...prev, isOpen: false }))
		document.removeEventListener('click', handleClickOutside)
		document.removeEventListener('keydown', handleKeyDown)
	}

	onCleanup(() => {
		document.removeEventListener('click', handleClickOutside)
		document.removeEventListener('keydown', handleKeyDown)
	})

	const pane = () => {
		const node = layout.state.nodes[props.paneId]
		return node && isPane(node) ? (node as EditorPane) : null
	}

	const handleClose = () => {
		layout.closeTab(props.paneId, props.tab.id)
		closeMenu()
	}

	const handleCloseOthers = () => {
		const currentPane = pane()
		if (!currentPane) return

		const otherTabs = currentPane.tabs.filter((t) => t.id !== props.tab.id)
		for (const tab of otherTabs) {
			layout.closeTab(props.paneId, tab.id)
		}
		closeMenu()
	}

	const handleCloseAll = () => {
		const currentPane = pane()
		if (!currentPane) return

		const tabIds = currentPane.tabs.map((t) => t.id)
		for (const tabId of tabIds) {
			layout.closeTab(props.paneId, tabId)
		}
		closeMenu()
	}

	const handleCloseToRight = () => {
		const currentPane = pane()
		if (!currentPane) return

		const currentIndex = currentPane.tabs.findIndex(
			(t) => t.id === props.tab.id
		)
		if (currentIndex === -1) return

		const tabsToClose = currentPane.tabs.slice(currentIndex + 1)
		for (const tab of tabsToClose) {
			layout.closeTab(props.paneId, tab.id)
		}
		closeMenu()
	}

	const handleCopyPath = () => {
		const filePath =
			props.tab.content.type === 'file' ? props.tab.content.filePath : null
		if (filePath) {
			navigator.clipboard.writeText(filePath)
			toast.success('Path copied to clipboard')
		}
		closeMenu()
	}

	const handleCopyFileName = () => {
		const filePath =
			props.tab.content.type === 'file' ? props.tab.content.filePath : null
		if (filePath) {
			const fileName = filePath.split('/').pop() || filePath
			navigator.clipboard.writeText(fileName)
			toast.success('File name copied to clipboard')
		}
		closeMenu()
	}

	const handleSplitRight = () => {
		const newPaneId = layout.splitPane(props.paneId, 'horizontal')
		if (
			newPaneId &&
			props.tab.content.type === 'file' &&
			props.tab.content.filePath
		) {
			layout.moveTab(props.paneId, props.tab.id, newPaneId)
		}
		closeMenu()
	}

	const handleSplitDown = () => {
		const newPaneId = layout.splitPane(props.paneId, 'vertical')
		if (
			newPaneId &&
			props.tab.content.type === 'file' &&
			props.tab.content.filePath
		) {
			layout.moveTab(props.paneId, props.tab.id, newPaneId)
		}
		closeMenu()
	}

	const hasFilePath = () =>
		props.tab.content.type === 'file' && props.tab.content.filePath

	const hasOtherTabs = () => {
		const currentPane = pane()
		return currentPane ? currentPane.tabs.length > 1 : false
	}

	const hasTabsToRight = () => {
		const currentPane = pane()
		if (!currentPane) return false
		const currentIndex = currentPane.tabs.findIndex(
			(t) => t.id === props.tab.id
		)
		return currentIndex < currentPane.tabs.length - 1
	}

	return (
		<>
			{props.children({ onContextMenu: openMenu })}

			<Show when={menuState().isOpen}>
				<Portal>
					<div
						ref={menuRef}
						class="fixed z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
						style={{
							left: `${menuState().position.x}px`,
							top: `${menuState().position.y}px`,
						}}
					>
						<MenuItem onClick={handleClose}>
							Close
							<MenuShortcut>Alt+W</MenuShortcut>
						</MenuItem>
						<MenuItem onClick={handleCloseOthers} disabled={!hasOtherTabs()}>
							Close Others
						</MenuItem>
						<MenuItem onClick={handleCloseToRight} disabled={!hasTabsToRight()}>
							Close to the Right
						</MenuItem>
						<MenuItem onClick={handleCloseAll}>Close All</MenuItem>

						<MenuSeparator />

						<Show when={hasFilePath()}>
							<MenuItem onClick={handleCopyPath}>Copy Path</MenuItem>
							<MenuItem onClick={handleCopyFileName}>Copy File Name</MenuItem>
							<MenuSeparator />
						</Show>

						<MenuItem onClick={handleSplitRight}>
							Split Right
							<MenuShortcut>Cmd+\</MenuShortcut>
						</MenuItem>
						<MenuItem onClick={handleSplitDown}>
							Split Down
							<MenuShortcut>Cmd+Shift+\</MenuShortcut>
						</MenuItem>
					</div>
				</Portal>
			</Show>
		</>
	)
}

function MenuItem(props: {
	onClick: () => void
	disabled?: boolean
	children: JSX.Element
}) {
	return (
		<button
			class="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
			classList={{
				'opacity-50 pointer-events-none': props.disabled,
			}}
			onClick={() => props.onClick()}
			disabled={props.disabled}
		>
			{props.children}
		</button>
	)
}

function MenuSeparator() {
	return <div class="-mx-1 my-1 h-px bg-muted" />
}

function MenuShortcut(props: { children: JSX.Element }) {
	return (
		<span class="ml-auto text-xs tracking-widest opacity-60">
			{props.children}
		</span>
	)
}
