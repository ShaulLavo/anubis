import { createStore, reconcile } from 'solid-js/store'
import type { VisibleContentSnapshot } from '@repo/code-editor'

export const createVisibleContentState = () => {
	const [visibleContents, setVisibleContentsStore] = createStore<
		Record<string, VisibleContentSnapshot | undefined>
	>({})

	const setVisibleContent = (
		path: string,
		content?: VisibleContentSnapshot
	) => {
		if (!path) return
		if (!content) {
			setVisibleContentsStore(path, undefined)
			return
		}

		setVisibleContentsStore(path, content)
	}

	const clearVisibleContents = () => {
		setVisibleContentsStore(reconcile({}))
	}

	return {
		visibleContents,
		setVisibleContent,
		clearVisibleContents,
	}
}
