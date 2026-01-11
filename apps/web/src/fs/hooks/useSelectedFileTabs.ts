import { createEffect } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { FsActions } from '../context/FsContext'
import { useTabs } from './useTabs'
import { detectAvailableViewModes } from '../utils/viewModeDetection'

type UseSelectedFileTabsParams = {
	currentPath: Accessor<string | undefined>
	selectedPath: Accessor<string | undefined>
	selectPath: FsActions['selectPath']
	setOpenTabs: FsActions['fileCache']['setOpenTabs']
	maxTabs?: number
}

export const useSelectedFileTabs = (params: UseSelectedFileTabsParams) => {
	// Create a computed tab ID from current path only (no view mode in tab ID)
	const currentTabId = () => {
		const path = params.currentPath()
		return path || undefined
	}

	const [tabsState, tabsActions] = useTabs(currentTabId, {
		maxTabs: params.maxTabs,
	})

	createEffect(() => {
		params.setOpenTabs(tabsState())
	})

	const handleTabSelect = (tabId: string) => {
		if (!tabId) return

		if (tabId === params.selectedPath()) return
		void params.selectPath(tabId)
	}

	const handleTabClose = (tabId: string) => {
		const selectedPath = params.selectedPath()

		const isClosingActiveTab = tabId === selectedPath
		const previousTabId = isClosingActiveTab
			? tabsActions.getPreviousTab(tabId)
			: undefined

		tabsActions.closeTab(tabId)

		if (!isClosingActiveTab) return

		const nextPath = previousTabId || ''
		void params.selectPath(nextPath)
	}

	const tabLabel = (tabId: string) => {
		const path = tabId
		const fileName = path.split('/').pop() || path
		return fileName
	}

	// Enhanced tooltip information for tabs (Requirements 8.4)
	const getTabTooltip = (tabId: string) => {
		const path = tabId
		return path
	}

	// Check if a file supports multiple view modes (Requirements 2.1, 2.4)
	const supportsMultipleViewModes = (path: string) => {
		const availableModes = detectAvailableViewModes(path)
		return availableModes.length > 1
	}

	const getAvailableViewModes = (path: string) => {
		return detectAvailableViewModes(path)
	}

	return {
		tabsState,
		handleTabSelect,
		handleTabClose,
		tabLabel,
		getTabTooltip,
		supportsMultipleViewModes,
		getAvailableViewModes,
	}
}
