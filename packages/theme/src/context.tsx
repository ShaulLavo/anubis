import { useColorMode } from '@kobalte/core'
import { trackStore } from '@solid-primitives/deep'
import {
	createContext,
	createEffect,
	createMemo,
	createSignal,
	useContext,
	type JSX,
} from 'solid-js'
import { createStore, unwrap, type SetStoreFunction } from 'solid-js/store'
import { syncToCssVars } from './cssVars'
import { DARK_THEME, LIGHT_THEME } from './palettes'
import type { ThemeMode, ThemePalette } from './types'

type ThemeContextValue = {
	theme: ThemePalette
	setTheme: SetStoreFunction<ThemePalette>
	trackedTheme: () => ThemePalette
	isDark: () => boolean
	mode: () => ThemeMode
	setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>()

export const ThemeProvider = (props: { children: JSX.Element }) => {
	const { colorMode, setColorMode } = useColorMode()
	// Kobalte resolves 'system' to 'light' or 'dark', so we can't trust colorMode() for the preference.
	// We need to track the preference manually to show the correct icon/state in the UI.
	// TODO: Rewrite this to not rely on Kobalte's createLocalStorageManager and useColorMode
	// to avoid this split state "jank" and have a single source of truth for the theme preference.
	const [mode, setMode] = createSignal<ThemeMode>(
		(localStorage.getItem('ui-theme') as ThemeMode | null) ?? 'system'
	)

	const isDark = createMemo(() => colorMode() === 'dark')
	const [theme, setTheme] = createStore<ThemePalette>(
		structuredClone(isDark() ? DARK_THEME : LIGHT_THEME)
	)

	createEffect(() => {
		setTheme(structuredClone(isDark() ? DARK_THEME : LIGHT_THEME))
	})

	const handleSetMode = (newMode: ThemeMode) => {
		setMode(newMode)
		setColorMode(newMode)
	}

	/*
	 * Deeply tracked accessor for theme changes.
	 * Use this ONLY when you need to track the entire store inside a createEffect.
	 * This is a rare use case - usually you just want to access specific properties.
	 */
	const trackedTheme = () => {
		trackStore(theme)
		return theme
	}
	createEffect(() => {
		syncToCssVars(unwrap(trackedTheme()))
	})

	const value: ThemeContextValue = {
		theme,
		setTheme,
		trackedTheme,
		isDark,
		mode,
		setMode: handleSetMode,
	}

	return (
		<ThemeContext.Provider value={value}>
			{props.children}
		</ThemeContext.Provider>
	)
}

export const useTheme = () => {
	const ctx = useContext(ThemeContext)
	if (!ctx) {
		throw new Error('useTheme must be used within a ThemeProvider')
	}

	return ctx
}
