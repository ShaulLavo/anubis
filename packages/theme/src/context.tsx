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

export type ThemeProviderProps = {
	children: JSX.Element
	/** Initial theme mode - if provided, overrides localStorage */
	initialMode?: ThemeMode
	/** Callback when mode changes (e.g., from ModeToggle clicks) */
	onModeChange?: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>()

export const ThemeProvider = (props: ThemeProviderProps) => {
	const { colorMode, setColorMode } = useColorMode()

	// Use initialMode prop if provided, otherwise fall back to localStorage
	const getInitialMode = (): ThemeMode => {
		if (props.initialMode) return props.initialMode
		return (localStorage.getItem('ui-theme') as ThemeMode | null) ?? 'system'
	}

	const [mode, setMode] = createSignal<ThemeMode>(getInitialMode())

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
		// Persist to localStorage for fast initial render on next page load
		localStorage.setItem('ui-theme', newMode)
		// Notify external listeners (settings system)
		props.onModeChange?.(newMode)
	}

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
