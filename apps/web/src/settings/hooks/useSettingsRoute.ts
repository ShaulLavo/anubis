import { useQueryState, parseAsString } from 'nuqs-solid'

export const useSettingsRoute = () => {
	// Type-safe query state for settings category
	const [settingsCategory, setSettingsCategory] = useQueryState(
		'settings',
		parseAsString
	)

	const isSettingsOpen = () => settingsCategory() !== null

	const currentCategory = () => settingsCategory() || 'editor'

	const openSettings = (category?: string) => {
		void setSettingsCategory(category || '')
	}

	const closeSettings = () => {
		void setSettingsCategory(null)
	}

	const navigateToCategory = (categoryId: string) => {
		void setSettingsCategory(categoryId)
	}

	return {
		isSettingsOpen,
		currentCategory,
		openSettings,
		closeSettings,
		navigateToCategory,
	}
}