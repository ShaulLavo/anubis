/* eslint-disable solid/reactivity */
import { createStore } from 'solid-js/store'

/**
 * Normalize path by stripping leading slash.
 * Cache keys use normalized paths (without leading slash).
 */
const normalizePath = (path: string): string =>
	path.startsWith('/') ? path.slice(1) : path

export const createDirtyState = () => {
	const [dirtyPaths, setDirtyPaths] = createStore<Record<string, boolean>>({})

	const setDirtyPath = (path: string, isDirty?: boolean) => {
		const p = normalizePath(path)
		if (isDirty === undefined || isDirty === false) {
			setDirtyPaths(p, undefined as unknown as boolean)
		} else {
			setDirtyPaths(p, isDirty)
		}
	}

	const clearDirtyPaths = () => {
		setDirtyPaths({})
	}

	return {
		dirtyPaths,
		setDirtyPath,
		clearDirtyPaths,
	}
}
