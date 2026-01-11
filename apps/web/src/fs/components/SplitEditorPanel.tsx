/**
 * Split Editor Panel
 *
 * Replaces the single editor with a split editor system.
 * Integrates with the existing file system context and provides
 * tab-based editing with split panes.
 */

import { onMount, type Accessor, type JSX } from 'solid-js';
import { SplitEditor } from '../../split-editor/components/SplitEditor';
import { FileTab } from '../../split-editor/components/FileTab';
import { createPersistedLayoutManager } from '../../split-editor/createPersistedLayoutManager';
import { createResourceManager } from '../../split-editor/createResourceManager';
import { createFileContent, isPane } from '../../split-editor/types';
import { useFs } from '../context/FsContext';
import { readFileText } from '../runtime/streaming';
import { DEFAULT_SOURCE } from '../config/constants';
import type { Tab, EditorPane, LayoutManager } from '../../split-editor';

type SplitEditorPanelProps = {
	isFileSelected: Accessor<boolean>;
	currentPath?: string;
	onLayoutManagerReady?: (layoutManager: LayoutManager) => void;
};

export const SplitEditorPanel = (props: SplitEditorPanelProps) => {
	const [state] = useFs();

	// Create resource manager first (needed for layout manager callback)
	const resourceManager = createResourceManager();

	// Create persisted layout manager with tab close callback for resource cleanup
	const layoutManager = createPersistedLayoutManager({
		onTabClose: (_paneId, closedTab) => {
			// Only cleanup file resources, not empty tabs
			if (closedTab.content.type !== 'file' || !closedTab.content.filePath) {
				return;
			}

			const filePath = closedTab.content.filePath;

			// Check if any other tabs still have this file open
			const remainingTab = layoutManager.findTabByFilePath(filePath);
			if (!remainingTab) {
				// No more tabs with this file - cleanup resources
				resourceManager.cleanupFileResources(filePath);
			}
		}
	});

	/**
	 * Preload file content from persisted layout BEFORE restoring.
	 * Returns list of file paths that failed to load (for later removal).
	 */
	const preloadPersistedFileContent = async (): Promise<string[]> => {
		const saved = layoutManager.getPersistedLayout();
		if (!saved) return [];

		const source = state.activeSource ?? DEFAULT_SOURCE;
		const failedPaths: string[] = [];

		console.log('[SplitEditorPanel] Preloading content for persisted layout');

		for (const node of saved.nodes) {
			if (node.type !== 'pane' || !node.tabs) continue;

			for (const tab of node.tabs) {
				if (tab.content.type !== 'file' || !tab.content.filePath) continue;
				const filePath = tab.content.filePath;

				if (filePath === 'Untitled') {
					resourceManager.preloadFileContent(filePath, '');
					continue;
				}

				try {
					console.log('[SplitEditorPanel] Preloading:', filePath);
					const content = await readFileText(source, filePath);
					console.log('[SplitEditorPanel] Preloaded:', filePath, 'length:', content.length);
					resourceManager.preloadFileContent(filePath, content);
				} catch (error) {
					console.warn(`[SplitEditorPanel] Failed to preload: ${filePath}`, error);
					failedPaths.push(filePath);
				}
			}
		}

		return failedPaths;
	};

	/**
	 * Remove tabs for files that failed to load.
	 */
	const removeFailedTabs = (failedPaths: string[]) => {
		if (failedPaths.length === 0) return;

		for (const filePath of failedPaths) {
			const found = layoutManager.findTabByFilePath(filePath);
			if (found) {
				try {
					layoutManager.closeTab(found.paneId, found.tab.id);
				} catch (e) {
					console.log('[SplitEditorPanel] Error removing tab:', e);
				}
			}
		}
	};

	// Initialize with persistence support
	onMount(async () => {
		console.log('[SplitEditorPanel] onMount starting');

		// IMPORTANT: Preload file content BEFORE initializing layout
		// This ensures buffers exist when FileTab components render
		const failedPaths = await preloadPersistedFileContent();

		// Now initialize (restore) the layout - FileTab components will find content ready
		layoutManager.initialize();

		console.log('[SplitEditorPanel] After initialize, state:', {
			rootId: layoutManager.state.rootId,
			nodes: Object.entries(layoutManager.state.nodes).map(([id, node]) => ({
				id,
				type: isPane(node) ? 'pane' : 'container',
				tabs: isPane(node) ? (node as EditorPane).tabs.length : undefined
			}))
		});

		// Remove tabs for files that failed to load
		removeFailedTabs(failedPaths);

		// If no tabs after restoration (or fresh start), open an untitled file
		const hasTabs = Object.values(layoutManager.state.nodes).some(
			node => isPane(node) && (node as EditorPane).tabs.length > 0
		);

		if (!hasTabs) {
			const focusedPaneId = layoutManager.state.focusedPaneId;
			console.log('[SplitEditorPanel] Creating untitled file in pane:', focusedPaneId);
			if (focusedPaneId) {
				const untitledPath = 'Untitled';
				resourceManager.preloadFileContent(untitledPath, '');
				const content = createFileContent(untitledPath);
				layoutManager.openTab(focusedPaneId, content);
			}
		}

		// Notify parent that layout manager is ready
		props.onLayoutManagerReady?.(layoutManager);
		console.log('[SplitEditorPanel] onMount complete');
	});

	// Function to open a file as a tab (exposed for external use)
	const openFileAsTab = async (filePath: string) => {
		const focusedPaneId = layoutManager.state.focusedPaneId;
		if (!focusedPaneId) return;

		// Check if file is already open in any pane
		const existingTab = layoutManager.findTabByFilePath(filePath);
		if (existingTab) {
			// Switch to existing tab
			layoutManager.setActiveTab(existingTab.paneId, existingTab.tab.id);
			layoutManager.setFocusedPane(existingTab.paneId);
			return;
		}

		// Pre-load file content
		let fileContent = '';
		try {
			const source = state.activeSource ?? DEFAULT_SOURCE;
			fileContent = await readFileText(source, filePath);
		} catch (error) {
			console.error(`[SplitEditorPanel] Failed to load file content for ${filePath}:`, error);
			// Continue with empty content - file will be editable as empty file
		}

		// Pre-populate the buffer with file content before creating the tab
		resourceManager.preloadFileContent(filePath, fileContent);

		// Create new tab with file content
		const content = createFileContent(filePath);
		layoutManager.openTab(focusedPaneId, content);
	}

		// Expose the openFileAsTab function
		; (layoutManager as any).openFileAsTab = openFileAsTab;

	// Custom tab content renderer that integrates with existing editor
	const renderTabContent = (tab: Tab, pane: EditorPane): JSX.Element => {
		if (tab.content.type === 'empty') {
			// This is the "no tabs" state - show welcome message
			return (
				<div class="h-full w-full flex items-center justify-center text-muted-foreground">
					<div class="text-center">
						<div class="text-lg font-medium mb-2">Welcome to Split Editor</div>
						<div class="text-sm">
							Select a file from the tree to start editing
						</div>
					</div>
				</div>
			);
		}

		if (tab.content.type === 'file' && tab.content.filePath) {
			// Always render FileTab for file content - it will handle empty files and loading states
			return (
				<FileTab
					tab={tab}
					pane={pane}
					filePath={tab.content.filePath}
				/>
			);
		}

		return (
			<div class="h-full w-full flex items-center justify-center text-muted-foreground">
				<div class="text-center">
					<div class="text-lg font-medium mb-2">Split Editor</div>
					<div class="text-sm">Empty tab</div>
				</div>
			</div>
		);
	};

	return (
		<div class="h-full w-full">
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={renderTabContent}
			/>
		</div>
	);
};