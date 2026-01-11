/**
 * Split Editor Panel
 *
 * Replaces the single editor with a split editor system.
 * Integrates with the existing file system context and provides
 * tab-based editing with split panes.
 *
 * Requirements: 5.3, 5.4, 5.5 - Error handling, file type detection, large files
 */

import { onMount, type Accessor, type JSX } from 'solid-js'
import { toast } from '@repo/ui/toaster'
import { SplitEditor } from '../../split-editor/components/SplitEditor'
import { FileTab } from '../../split-editor/components/FileTab'
import { createPersistedLayoutManager } from '../../split-editor/createPersistedLayoutManager'
import { createResourceManager } from '../../split-editor/createResourceManager'
import { createFileContent, isPane } from '../../split-editor/types'
import { useFs } from '../context/FsContext'
import { readFileText, getFileSize } from '../runtime/streaming'
import { DEFAULT_SOURCE } from '../config/constants'
import type { Tab, EditorPane, LayoutManager } from '../../split-editor'
import {
	classifyError,
	isBinaryExtension,
	isBinaryContent,
	createBinaryFileError,
	createFileTooLargeError,
	createNotFoundError,
	MAX_FILE_SIZE,
	LARGE_FILE_THRESHOLD,
	getErrorTitle,
} from '../../split-editor/fileLoadingErrors'

type SplitEditorPanelProps = {
	isFileSelected: Accessor<boolean>
	currentPath?: string
	onLayoutManagerReady?: (layoutManager: LayoutManager) => void
}

export const SplitEditorPanel = (props: SplitEditorPanelProps) => {
	const [state] = useFs()

	// Create resource manager first (needed for layout manager callback)
	const resourceManager = createResourceManager()

	// Create persisted layout manager with tab close callback for resource cleanup
	const layoutManager = createPersistedLayoutManager({
		onTabClose: (_paneId, closedTab) => {
			// Only cleanup file resources, not empty tabs
			if (closedTab.content.type !== 'file' || !closedTab.content.filePath) {
				return
			}

			const filePath = closedTab.content.filePath

			// Check if any other tabs still have this file open
			const remainingTab = layoutManager.findTabByFilePath(filePath)
			if (!remainingTab) {
				resourceManager.cleanupFileResources(filePath)
			}
		},
	})

	/**
	 * Preload file content from persisted layout BEFORE restoring.
	 * Returns list of file paths that failed to load (for later removal).
	 */
	const preloadPersistedFileContent = async (): Promise<string[]> => {
		const saved = layoutManager.getPersistedLayout()
		if (!saved) return []

		const source = state.activeSource ?? DEFAULT_SOURCE
		const failedPaths: string[] = []

		for (const node of saved.nodes) {
			if (node.type !== 'pane' || !node.tabs) continue

			for (const tab of node.tabs) {
				if (tab.content.type !== 'file' || !tab.content.filePath) continue
				const filePath = tab.content.filePath

				if (filePath === 'Untitled') {
					resourceManager.preloadFileContent(filePath, '')
					continue
				}

				try {
					const content = await readFileText(source, filePath)

					resourceManager.preloadFileContent(filePath, content)
				} catch (error) {
					console.warn(
						`[SplitEditorPanel] Failed to preload: ${filePath}`,
						error
					)
					failedPaths.push(filePath)
				}
			}
		}

		return failedPaths
	}

	/**
	 * Remove tabs for files that failed to load.
	 */
	const removeFailedTabs = (failedPaths: string[]) => {
		if (failedPaths.length === 0) return

		for (const filePath of failedPaths) {
			const found = layoutManager.findTabByFilePath(filePath)
			if (found) {
				try {
					layoutManager.closeTab(found.paneId, found.tab.id)
				} catch (e) {
					console.log('[SplitEditorPanel] Error removing tab:', e)
				}
			}
		}
	}

	// Initialize with persistence support
	onMount(async () => {
		// IMPORTANT: Preload file content BEFORE initializing layout
		// This ensures buffers exist when FileTab components render
		const failedPaths = await preloadPersistedFileContent()

		layoutManager.initialize()

		removeFailedTabs(failedPaths)

		// If no tabs after restoration (or fresh start), open an untitled file
		const hasTabs = Object.values(layoutManager.state.nodes).some(
			(node) => isPane(node) && (node as EditorPane).tabs.length > 0
		)

		if (!hasTabs) {
			const focusedPaneId = layoutManager.state.focusedPaneId

			if (focusedPaneId) {
				const untitledPath = 'Untitled'
				resourceManager.preloadFileContent(untitledPath, '')
				const content = createFileContent(untitledPath)
				layoutManager.openTab(focusedPaneId, content)
			}
		}

		// Notify parent that layout manager is ready
		props.onLayoutManagerReady?.(layoutManager)
	})

	const openFileAsTab = async (filePath: string) => {
		const focusedPaneId = layoutManager.state.focusedPaneId
		if (!focusedPaneId) return

		const existingTab = layoutManager.findTabByFilePath(filePath)
		if (existingTab) {
			layoutManager.setActiveTab(existingTab.paneId, existingTab.tab.id)
			layoutManager.setFocusedPane(existingTab.paneId)
			return
		}

		const source = state.activeSource ?? DEFAULT_SOURCE

		// Pre-create the resource to track loading state
		resourceManager.preloadFileContent(filePath, '')
		resourceManager.setFileLoadingStatus(filePath, 'loading')

		// Create the tab first (shows loading indicator)
		const content = createFileContent(filePath)
		layoutManager.openTab(focusedPaneId, content)

		// Check if it's a known binary file type first
		if (isBinaryExtension(filePath)) {
			// const error = createBinaryFileError(filePath)
			resourceManager.setFileMetadata(filePath, { isBinary: true })
			resourceManager.setFileLoadingStatus(filePath, 'loaded')
			toast.warning(`${filePath.split('/').pop()} is a binary file`)
			return
		}

		try {
			// Check file size first
			const fileSize = await getFileSize(source, filePath)
			resourceManager.setFileMetadata(filePath, { size: fileSize })

			if (fileSize > MAX_FILE_SIZE) {
				const error = createFileTooLargeError(filePath, fileSize)
				resourceManager.setFileError(filePath, error)
				toast.error(`${getErrorTitle(error.type)}: ${error.message}`)
				return
			}

			// Read the file content
			const fileContent = await readFileText(source, filePath)

			// Check if content appears to be binary
			const encoder = new TextEncoder()
			const buffer = encoder.encode(fileContent).buffer
			if (isBinaryContent(buffer)) {
				resourceManager.setFileMetadata(filePath, { isBinary: true })
				resourceManager.setFileLoadingStatus(filePath, 'loaded')
				toast.warning(
					`${filePath.split('/').pop()} appears to be a binary file`
				)
				return
			}

			// Success - set content and mark as loaded
			resourceManager.preloadFileContent(filePath, fileContent)
			resourceManager.setFileLoadingStatus(filePath, 'loaded')
		} catch (error) {
			console.error(
				`[SplitEditorPanel] Failed to load file content for ${filePath}:`,
				error
			)

			// Classify the error and set it
			const fileError = classifyError(filePath, error)
			resourceManager.setFileError(filePath, fileError)

			// Show toast notification
			toast.error(`${getErrorTitle(fileError.type)}: ${fileError.message}`)
		}
	}

	// Expose openFileAsTab
	Object.assign(layoutManager, { openFileAsTab })

	// Custom tab content renderer that integrates with existing editor
	const renderTabContent = (tab: Tab, pane: EditorPane): JSX.Element => {
		if (tab.content.type === 'empty') {
			return (
				<div class="h-full w-full flex items-center justify-center text-muted-foreground">
					<div class="text-center">
						<div class="text-lg font-medium mb-2">Welcome to Split Editor</div>
						<div class="text-sm">
							Select a file from the tree to start editing
						</div>
					</div>
				</div>
			)
		}

		if (tab.content.type === 'file' && tab.content.filePath) {
			// Always render FileTab for file content - it will handle empty files and loading states
			return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
		}

		return (
			<div class="h-full w-full flex items-center justify-center text-muted-foreground">
				<div class="text-center">
					<div class="text-lg font-medium mb-2">Split Editor</div>
					<div class="text-sm">Empty tab</div>
				</div>
			</div>
		)
	}

	return (
		<div class="h-full w-full">
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={renderTabContent}
			/>
		</div>
	)
}
