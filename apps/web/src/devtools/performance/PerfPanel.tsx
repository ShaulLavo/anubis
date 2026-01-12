import { createSignal, onMount, onCleanup, Show, type Component } from 'solid-js'
import type { PerfRecord } from '@repo/perf'
import { clear as clearPerfStore } from '@repo/perf'
import { perfEventClient } from './perfEventClient'
import { TimelineTab } from './tabs/TimelineTab'
import { SummaryTab } from './tabs/SummaryTab'
import { TracesTab } from './tabs/TracesTab'
import { BenchmarksTab } from './tabs/BenchmarksTab'

type TabId = 'timeline' | 'summary' | 'traces' | 'benchmarks'

const tabs: { id: TabId; label: string }[] = [
	{ id: 'timeline', label: 'Timeline' },
	{ id: 'summary', label: 'Summary' },
	{ id: 'traces', label: 'Traces' },
	{ id: 'benchmarks', label: 'Benchmarks' },
]

/**
 * Main Performance Panel for TanStack Devtools
 */
export const PerfPanel: Component = () => {
	const [activeTab, setActiveTab] = createSignal<TabId>('timeline')
	const [records, setRecords] = createSignal<PerfRecord[]>([])

	onMount(() => {
		// Subscribe to performance records from the event client
		const cleanup = perfEventClient.on('record', (e) => {
			setRecords((prev) => [...prev.slice(-99), e.payload]) // Keep last 100
		})
		onCleanup(cleanup)
	})

	const handleClear = () => {
		setRecords([])
		clearPerfStore()
	}

	return (
		<div class="h-full flex flex-col bg-gray-900 text-gray-100">
			{/* Tab bar */}
			<div class="flex items-center border-b border-gray-700">
				<div class="flex">
					{tabs.map((tab) => (
						<button
							class={`px-4 py-2 text-sm font-medium transition-colors ${
								activeTab() === tab.id
									? 'text-purple-400 border-b-2 border-purple-400'
									: 'text-gray-400 hover:text-gray-200'
							}`}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</button>
					))}
				</div>
				<div class="flex-1" />
				<button
					class="px-3 py-1 mr-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
					onClick={handleClear}
				>
					Clear
				</button>
			</div>

			{/* Tab content */}
			<div class="flex-1 overflow-hidden">
				<Show when={activeTab() === 'timeline'}>
					<TimelineTab records={records()} />
				</Show>
				<Show when={activeTab() === 'summary'}>
					<SummaryTab />
				</Show>
				<Show when={activeTab() === 'traces'}>
					<TracesTab />
				</Show>
				<Show when={activeTab() === 'benchmarks'}>
					<BenchmarksTab />
				</Show>
			</div>
		</div>
	)
}
