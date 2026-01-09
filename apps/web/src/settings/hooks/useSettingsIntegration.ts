import { useFs } from '../../fs/context/FsContext'
import { useSettingsRoute } from './useSettingsRoute'

const SETTINGS_FILE_PATH = '/.system/settings.json'

export const useSettingsIntegration = () => {
	const [, { selectPath }] = useFs()
	
	// Safely initialize settings route with error handling
	let settingsRoute: ReturnType<typeof useSettingsRoute> | null = null
	try {
		settingsRoute = useSettingsRoute()
	} catch (error) {
		console.warn('[useSettingsIntegration] Settings route not available:', error)
	}

	const openSettings = async (category?: string) => {
		if (settingsRoute) {
			// Use the settings route to open settings UI
			settingsRoute.openSettings(category)
		}
		// Also ensure the settings file is selected for tab management
		await selectPath(SETTINGS_FILE_PATH)
	}

	const openJSONView = async () => {
		if (settingsRoute) {
			// Use the settings route to open JSON view
			settingsRoute.openJSONView()
		}
		// Also ensure the settings file is selected for tab management
		await selectPath(SETTINGS_FILE_PATH)
	}

	const closeSettings = () => {
		if (settingsRoute) {
			settingsRoute.closeSettings()
		}
		// Note: We don't close the file tab here as the user might want to keep it open
	}

	const isSettingsFile = (path: string | undefined) => {
		return path === SETTINGS_FILE_PATH
	}

	return {
		openSettings,
		openJSONView,
		closeSettings,
		isSettingsFile,
		SETTINGS_FILE_PATH,
		// Re-export routing functions for convenience (with null checks)
		isSettingsOpen: () => settingsRoute?.isSettingsOpen() ?? false,
		isJSONView: () => settingsRoute?.isJSONView() ?? false,
		currentCategory: () => settingsRoute?.currentCategory() ?? 'editor',
		navigateToCategory: (categoryId: string) => settingsRoute?.navigateToCategory(categoryId),
	}
}