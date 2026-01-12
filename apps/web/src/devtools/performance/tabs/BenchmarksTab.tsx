import { createSignal, Show, type Component } from 'solid-js'
import { StoreBenchPanel } from '../benchmarks/StoreBenchPanel'
import { VfsPathBenchPanel } from '../benchmarks/VfsPathBenchPanel'
import { ScrollBenchPanel } from '../benchmarks/ScrollBenchPanel'

type BenchmarkId = 'storage' | 'vfs-path' | 'scroll'

const benchmarks: { id: BenchmarkId; label: string }[] = [
	{ id: 'storage', label: 'Storage' },
	{ id: 'vfs-path', label: 'VFS Path' },
	{ id: 'scroll', label: 'Scroll' },
]

/**
 * Benchmarks tab containing sub-panels for different benchmark types
 */
export const BenchmarksTab: Component = () => {
	const [activeBenchmark, setActiveBenchmark] =
		createSignal<BenchmarkId>('storage')

	return (
		<div class="h-full flex flex-col">
			{/* Sub-tab navigation */}
			<div class="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/30">
				{benchmarks.map((bench) => (
					<button
						class={`px-3 py-1 text-xs font-medium rounded transition-colors ${
							activeBenchmark() === bench.id
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
						onClick={() => setActiveBenchmark(bench.id)}
					>
						{bench.label}
					</button>
				))}
			</div>

			{/* Benchmark content */}
			<div class="flex-1 overflow-hidden">
				<Show when={activeBenchmark() === 'storage'}>
					<StoreBenchPanel />
				</Show>
				<Show when={activeBenchmark() === 'vfs-path'}>
					<VfsPathBenchPanel />
				</Show>
				<Show when={activeBenchmark() === 'scroll'}>
					<ScrollBenchPanel />
				</Show>
			</div>
		</div>
	)
}
