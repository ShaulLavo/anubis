import { useSearchParams } from '@solidjs/router'

export const useSettingsRoute = () => {
	const [searchParams, setSearchParams] = useSearchParams()

	// Type-safe query state for settings category or view mode
	const settingsCategory = () => {
		const value = searchParams.settings
		return Array.isArray(value) ? value[0] || null : value || null
	}
	const viewMode = () => {
		const value = searchParams.view
		return Array.isArray(value) ? value[0] || null : value || null
	}

	const isSettingsOpen = () => settingsCategory() !== null

	const isJSONView = () => {
		// Check both ?settings=json and ?view=json patterns
		return settingsCategory() === 'json' || viewMode() === 'json'
	}

	const currentCategory = () => {
		const category = settingsCategory()
		// If in JSON view or no category specified, default to 'editor'
		return category === 'json' || !category ? 'editor' : category
	}

	const openSettings = (category?: string) => {
		// Clear view mode when opening regular settings
		setSearchParams({ settings: category || '', view: undefined })
	}

	const openJSONView = () => {
		// Use view=json parameter for JSON view
		setSearchParams({ settings: '', view: 'json' })
	}

	const closeSettings = () => {
		setSearchParams({ settings: undefined, view: undefined })
	}

	const navigateToCategory = (categoryId: string) => {
		// Clear view mode when navigating to a category
		setSearchParams({ settings: categoryId, view: undefined })
	}

	return {
		isSettingsOpen,
		isJSONView,
		currentCategory,
		openSettings,
		openJSONView,
		closeSettings,
		navigateToCategory,
	}
}