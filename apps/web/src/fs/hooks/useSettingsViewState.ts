import { createEffect, createMemo } from 'solid-js'
import type { Accessor } from 'solid-js'
import { useSettingsRoute } from '../../settings/hooks/useSettingsRoute'

const SETTINGS_FILE_PATH = '/.system/settings.json'

type UseSettingsViewStateParams = {
	selectedPath: Accessor<string | undefined>
	isLoading: Accessor<boolean>
	isSelectedFileLoading: Accessor<boolean>
	selectPath: (path: string) => Promise<void> | void
}

export const useSettingsViewState = (params: UseSettingsViewStateParams) => {
	const settingsRoute = useSettingsRoute()

	const isSettingsFile = createMemo(
		() => params.selectedPath() === SETTINGS_FILE_PATH
	)
	const shouldShowSettings = createMemo(
		() => settingsRoute.isSettingsOpen() || isSettingsFile()
	)
	const shouldShowJSONView = createMemo(() => settingsRoute.isJSONView())

	const handleCategoryChange = (
		categoryId: string,
		parentCategoryId?: string
	) => {
		settingsRoute.navigateToCategory(categoryId, parentCategoryId)
	}

	createEffect(() => {
		if (!settingsRoute.isSettingsOpen()) return
		if (isSettingsFile()) return
		if (params.isLoading() || params.isSelectedFileLoading()) return

		void params.selectPath(SETTINGS_FILE_PATH)
	})

	return {
		settingsRoute,
		isSettingsFile,
		shouldShowSettings,
		shouldShowJSONView,
		handleCategoryChange,
	}
}
