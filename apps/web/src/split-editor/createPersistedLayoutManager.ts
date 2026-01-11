/* eslint-disable solid/reactivity */
/**
 * Persisted Layout Manager
 *
 * Wraps the base layout manager with auto-persistence using makePersisted and dualStorage.
 * Automatically saves layout changes with debouncing and restores on initialization.
 */

import { createEffect, createSignal, onCleanup } from 'solid-js';
import { makePersisted } from '@solid-primitives/storage';
import { dualStorage } from '@repo/utils/DualStorage';
import { createLayoutManager, type LayoutManager, type LayoutManagerOptions } from './createLayoutManager';
import type { SerializedLayout } from './types';

const PERSISTENCE_KEY = 'split-editor-layout';
const DEBOUNCE_MS = 500;

export interface PersistedLayoutManager extends LayoutManager {
	/**
	 * Clear persisted layout from storage.
	 * Useful for testing or resetting the layout.
	 */
	clearPersistedLayout(): void;

	/**
	 * Get the persisted layout without restoring it.
	 * Useful for preloading file content before initialization.
	 */
	getPersistedLayout(): SerializedLayout | null;
}

export function createPersistedLayoutManager(options: LayoutManagerOptions = {}): PersistedLayoutManager {
	const baseManager = createLayoutManager(options);

	// Track whether we've initialized (to prevent persisting before restore)
	let isInitialized = false;

	// Create persisted signal for layout storage
	const layoutSignal = createSignal<SerializedLayout | null>(null);
	const [persistedLayout, setPersistedLayout] = makePersisted(layoutSignal, {
		storage: dualStorage,
		name: PERSISTENCE_KEY,
		serialize: JSON.stringify,
		deserialize: JSON.parse,
	});

	console.log('[PersistedLayoutManager] Created, initial persistedLayout:', persistedLayout());

	// Debounce timeout ref
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Debounced persistence function
	function persistLayout(): void {
		// Don't persist before initialization is complete
		if (!isInitialized) return;

		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		debounceTimeout = setTimeout(() => {
			const layout = baseManager.getLayoutTree();
			console.log('[PersistedLayoutManager] Persisting layout:', {
				rootId: layout.rootId,
				nodeCount: layout.nodes.length,
				nodes: layout.nodes.map(n => ({
					id: n.id,
					type: n.type,
					tabs: n.tabs?.length,
					activeTabId: n.activeTabId
				}))
			});
			setPersistedLayout(layout);
			debounceTimeout = null;
		}, DEBOUNCE_MS);
	}

	// Set up auto-persistence effect at creation time (inside reactive context)
	// This effect will run whenever the layout state changes
	createEffect(() => {
		// Access state properties to track them reactively
		const rootId = baseManager.state.rootId;
		const nodes = baseManager.state.nodes;
		// Track these properties without using their values
		void baseManager.state.focusedPaneId;
		void baseManager.state.scrollSyncGroups;

		// Deep track all nodes and their tabs to detect any changes
		// This is necessary because SolidJS only tracks accessed properties
		let tabCount = 0;
		for (const nodeId of Object.keys(nodes)) {
			const node = nodes[nodeId];
			if (node && 'tabs' in node) {
				// Track activeTabId to detect tab selection changes
				void node.activeTabId;
				// Access tabs array and its length to track changes
				const tabs = node.tabs;
				tabCount += tabs.length;
				// Access each tab's properties to track changes
				for (const tab of tabs) {
					void tab.id;
					void tab.content;
					void tab.isDirty;
					void tab.viewMode;
					void tab.state;
				}
			}
		}

		console.log('[PersistedLayoutManager] Effect triggered, rootId:', rootId, 'nodeCount:', Object.keys(nodes).length, 'totalTabs:', tabCount);

		// Only persist if we have a valid layout (rootId exists) and we're initialized
		if (isInitialized && rootId && Object.keys(nodes).length > 0) {
			persistLayout();
		}
	});

	// Clean up debounce timeout when reactive context is disposed
	onCleanup(() => {
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
			debounceTimeout = null;
		}
	});

	// Override initialize to restore from storage first
	const originalInitialize = baseManager.initialize;
	function initialize(): void {
		const saved = persistedLayout();
		console.log('[PersistedLayoutManager] Initialize called, saved layout:', saved);
		console.log('[PersistedLayoutManager] isValidLayout:', saved ? isValidLayout(saved) : 'N/A');

		if (saved && isValidLayout(saved)) {
			try {
				console.log('[PersistedLayoutManager] Restoring layout with', saved.nodes.length, 'nodes');
				console.log('[PersistedLayoutManager] Saved activeTabIds:', saved.nodes
					.filter(n => n.type === 'pane')
					.map(n => {
						const activeTab = n.tabs?.find(t => t.id === n.activeTabId);
						const activeFilePath = activeTab?.content.type === 'file' ? activeTab.content.filePath : 'N/A';
						return {
							paneId: n.id,
							activeTabId: n.activeTabId,
							activeFilePath,
							allTabs: n.tabs?.map(t => ({ id: t.id, filePath: t.content.type === 'file' ? t.content.filePath : 'N/A' }))
						};
					}));
				baseManager.restoreLayout(saved);
				console.log('[PersistedLayoutManager] Layout restored, state:', {
					rootId: baseManager.state.rootId,
					nodeCount: Object.keys(baseManager.state.nodes).length,
					panes: Object.values(baseManager.state.nodes)
						.filter(n => n.type === 'pane')
						.map(n => ({ id: n.id, activeTabId: (n as any).activeTabId }))
				});
			} catch (error) {
				console.error('[PersistedLayoutManager] Failed to restore layout, initializing fresh:', error);
				originalInitialize();
			}
		} else {
			console.log('[PersistedLayoutManager] No valid saved layout, initializing fresh');
			originalInitialize();
		}

		// Mark as initialized to enable persistence
		isInitialized = true;
	}

	function clearPersistedLayout(): void {
		setPersistedLayout(null);
	}

	function getPersistedLayout(): SerializedLayout | null {
		const saved = persistedLayout();
		if (saved && isValidLayout(saved)) {
			return saved;
		}
		return null;
	}

	return {
		...baseManager,
		initialize,
		clearPersistedLayout,
		getPersistedLayout,
	};
}

/**
 * Validate that a serialized layout has the minimum required structure.
 * This helps handle cases where stored data might be corrupted or from an older version.
 */
function isValidLayout(layout: SerializedLayout): boolean {
	if (!layout || typeof layout !== 'object') return false;
	if (layout.version !== 1) return false;
	if (!layout.rootId || typeof layout.rootId !== 'string') return false;
	if (!Array.isArray(layout.nodes) || layout.nodes.length === 0) return false;

	// Verify the root node exists in the nodes array
	const rootNode = layout.nodes.find((n) => n.id === layout.rootId);
	if (!rootNode) return false;

	return true;
}
