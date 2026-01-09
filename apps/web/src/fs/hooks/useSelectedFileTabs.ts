import { createEffect } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { FsActions } from '../context/FsContext'
import { useTabs } from './useTabs'

const SETTINGS_FILE_PATH = '/.system/settings.json'

type UseSelectedFileTabsParams = {
	currentPath: Accessor<string | undefined>
	selectedPath: Accessor<string | undefined>
	selectPath: FsActions['selectPath']
	setOpenTabs: FsActions['fileCache']['setOpenTabs']
	shouldShowJSONView: Accessor<boolean>
	maxTabs?: number
}

export const useSelectedFileTabs = (params: UseSelectedFileTabsParams) => {
	const [tabsState, tabsActions] = useTabs(params.currentPath, {
		maxTabs: params.maxTabs,
	})

	createEffect(() => {
		params.setOpenTabs(tabsState())
	})

	const handleTabSelect = (path: string) => {
		if (!path) return
		if (path === params.selectedPath()) return
		void params.selectPath(path)
	}

	const handleTabClose = (path: string) => {
		const selectedPath = params.selectedPath()
		const isClosingActiveTab = path === selectedPath
		const previousTab = isClosingActiveTab
			? tabsActions.getPreviousTab(path)
			: undefined

		console.log(
			'[handleTabClose]',
			JSON.stringify(
				{
					path,
					isClosingActiveTab,
					previousTab,
					currentSelectedPath: selectedPath,
					tabsCount: tabsState().length,
				},
				null,
				2
			)
		)

		tabsActions.closeTab(path)

		if (!isClosingActiveTab) return

		const nextPath = previousTab ?? ''
		console.log(
			'[handleTabClose] switching tab',
			JSON.stringify({ nextPath }, null, 2)
		)
		void params.selectPath(nextPath)
	}

	const tabLabel = (path: string) => {
		if (path === SETTINGS_FILE_PATH) {
			return params.shouldShowJSONView() ? 'Settings (JSON)' : 'Settings'
		}
		return path.split('/').pop() || path
	}

	return {
		tabsState,
		handleTabSelect,
		handleTabClose,
		tabLabel,
	}
}
