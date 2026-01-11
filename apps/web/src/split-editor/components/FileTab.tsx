/**
 * FileTab Component
 *
 * A tab component that renders file content using the shared Resource Manager.
 * Registers/unregisters with Resource Manager on mount/cleanup and uses
 * shared buffer for content while maintaining independent tab state.
 * Supports multiple view modes: editor, ui (settings).
 *
 * Requirements: 2.1, 2.5, 5.3, 5.4, 5.5, 8.1, 8.2, 8.4, View Mode Support
 */

import {
	createEffect,
	createMemo,
	createResource,
	createSignal,
	Match,
	onCleanup,
	Show,
	Switch,
} from 'solid-js'
import { Editor } from '@repo/code-editor'
import { CursorMode } from '@repo/code-editor'
import type {
	EditorProps,
	ScrollPosition,
	DocumentIncrementalEdit,
} from '@repo/code-editor'
import { useLayoutManager, useResourceManager } from './SplitEditor'
import { useFocusManager } from '~/focus/focusManager'
import { getTreeSitterWorker } from '~/treeSitter/workerClient'
import { SettingsTab } from '~/settings/components/SettingsTab'
import type { Tab, EditorPane } from '../types'
import { createScrollSyncCoordinator } from '../createScrollSyncCoordinator'
import type { ScrollEvent } from '../createScrollSyncCoordinator'
import {
	FileLoadingErrorDisplay,
	FileLoadingIndicator,
	BinaryFileIndicator,
} from './FileLoadingErrorDisplay'

export interface FileTabProps {
	tab: Tab
	pane: EditorPane
	filePath: string
}

/**
 * FileTab - Renders file content with shared resources and independent state
 */
export function FileTab(props: FileTabProps) {
	const layoutManager = useLayoutManager()
	const resourceManager = useResourceManager()
	const focus = useFocusManager()

	const scrollSyncCoordinator = createScrollSyncCoordinator(layoutManager)

	// Settings category state for UI mode
	const [currentCategory, setCurrentCategory] = createSignal<string>('editor')

	// Get tree-sitter worker for minimap
	const [treeSitterWorker] = createResource(async () => {
		return getTreeSitterWorker()
	})

	// Register for file IMMEDIATELY (not in onMount) so buffer exists when memo runs
	createEffect(() => {
		resourceManager.registerTabForFile(props.tab.id, props.filePath)

		onCleanup(() => {
			resourceManager.unregisterTabFromFile(props.tab.id, props.filePath)
		})
	})

	const buffer = createMemo(() => resourceManager.getBuffer(props.filePath))

	const highlightState = createMemo(() =>
		resourceManager.getHighlightState(props.filePath)
	)

	const loadingState = createMemo(() =>
		resourceManager.getLoadingState(props.filePath)
	)

	// Create reactive accessors for highlights
	const highlights = createMemo(() => {
		const state = highlightState()
		if (!state) return undefined

		// Access signals to create dependencies
		state.captures()
		state.brackets()
		state.folds()
		state.errors()

		return {
			captures: state.captures,
			folds: state.folds,
			brackets: state.brackets,
			errors: state.errors,
		}
	})

	createEffect(() => {
		const sharedBuffer = buffer()
		if (!sharedBuffer) return

		const unsubscribe = sharedBuffer.onEdit(() => {})
		onCleanup(unsubscribe)
	})

	// Create document interface for the Editor
	const document = createMemo(() => {
		const sharedBuffer = buffer()

		if (!sharedBuffer) {
			return {
				filePath: () => props.filePath,
				content: () => '',
				pieceTable: () => undefined,
				updatePieceTable: () => {},
				isEditable: () => true,
				applyIncrementalEdit: undefined,
			}
		}

		return {
			filePath: () => props.filePath,
			content: sharedBuffer.content,
			pieceTable: () => undefined,
			updatePieceTable: () => {},
			isEditable: () => true,
			applyIncrementalEdit: (edit: DocumentIncrementalEdit) => {
				const textEdit = {
					startIndex: edit.startIndex,
					oldEndIndex: edit.oldEndIndex,
					newEndIndex: edit.newEndIndex,
					startPosition: {
						row: edit.startPosition.row,
						column: edit.startPosition.column,
					},
					oldEndPosition: {
						row: edit.oldEndPosition.row,
						column: edit.oldEndPosition.column,
					},
					newEndPosition: {
						row: edit.newEndPosition.row,
						column: edit.newEndPosition.column,
					},
					insertedText: edit.insertedText,
				}

				void sharedBuffer.applyEdit(textEdit)
				layoutManager.setTabDirty(props.pane.id, props.tab.id, true)
			},
		}
	})

	const handleScrollPositionChange = (position: ScrollPosition) => {
		layoutManager.updateTabState(props.pane.id, props.tab.id, {
			scrollTop: position.lineIndex,
			scrollLeft: position.scrollLeft,
		})

		const scrollEvent: ScrollEvent = {
			tabId: props.tab.id,
			scrollTop: position.lineIndex,
			scrollLeft: position.scrollLeft,
			scrollHeight: 1000,
			scrollWidth: 1000,
			clientHeight: 500,
			clientWidth: 500,
		}

		scrollSyncCoordinator.handleScroll(scrollEvent)
	}

	const initialScrollPosition = createMemo(
		(): ScrollPosition => ({
			lineIndex: props.tab.state.scrollTop,
			scrollLeft: props.tab.state.scrollLeft,
		})
	)

	const handleSave = () => {
		layoutManager.setTabDirty(props.pane.id, props.tab.id, false)
	}

	const editorProps = createMemo((): EditorProps => {
		const doc = document()
		const highlightData = highlights()
		const tsWorker = treeSitterWorker()

		return {
			document: doc,
			isFileSelected: () => true,
			stats: () => undefined,
			fontSize: () => props.pane.viewSettings.fontSize,
			fontFamily: () => 'JetBrains Mono, monospace',
			cursorMode: () => CursorMode.Regular,
			tabSize: () => 4,
			registerEditorArea: (resolver) => focus.registerArea('editor', resolver),
			activeScopes: focus.activeScopes,
			highlights: highlightData?.captures,
			folds: highlightData?.folds,
			brackets: highlightData?.brackets,
			errors: highlightData?.errors,
			treeSitterWorker: tsWorker ?? undefined,
			onSave: handleSave,
			initialScrollPosition: () => initialScrollPosition(),
			onScrollPositionChange: handleScrollPositionChange,
			initialVisibleContent: () => undefined,
			onCaptureVisibleContent: () => {},
		}
	})

	// Must be an accessor function for reactivity in SolidJS
	const viewMode = () => props.tab.viewMode ?? 'editor'

	// Reactive accessors for loading state
	const status = () => loadingState()?.status() ?? 'idle'
	const error = () => loadingState()?.error() ?? null
	const isBinary = () => loadingState()?.isBinary() ?? false
	const progress = () => loadingState()?.progress() ?? 0
	const fileSize = () => loadingState()?.fileSize() ?? null
	const retryCount = () => loadingState()?.retryCount() ?? 0

	// Handle retry for errors
	const handleRetry = () => {
		const state = loadingState()
		if (state) {
			state.incrementRetryCount()
			state.setStatus('loading')
			state.setError(null)
			// Trigger reload - the parent should handle the actual file loading
		}
	}

	return (
		<div
			class="file-tab absolute inset-0"
			data-testid="file-tab"
			data-file-path={props.filePath}
			data-tab-id={props.tab.id}
		>
			<Show when={status() === 'loading'}>
				<FileLoadingIndicator filePath={props.filePath} progress={progress()} />
			</Show>

			<Show when={status() === 'error' && error()}>
				<FileLoadingErrorDisplay
					error={error()!}
					filePath={props.filePath}
					retryCount={retryCount()}
					onRetry={handleRetry}
				/>
			</Show>

			<Show when={isBinary() && status() !== 'error'}>
				<BinaryFileIndicator
					filePath={props.filePath}
					fileSize={fileSize() ?? undefined}
				/>
			</Show>

			<Show
				when={status() !== 'loading' && status() !== 'error' && !isBinary()}
			>
				<Switch fallback={<Editor {...editorProps()} />}>
					<Match when={viewMode() === 'ui'}>
						<SettingsTab
							initialCategory={currentCategory()}
							currentCategory={currentCategory()}
							onCategoryChange={setCurrentCategory}
						/>
					</Match>
				</Switch>
			</Show>
		</div>
	)
}
