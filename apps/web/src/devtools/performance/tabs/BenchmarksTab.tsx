import { type Component } from 'solid-js'

/**
 * Benchmarks tab for running VFS and scroll benchmarks
 * TODO: Migrate benchmark dashboards here
 */
export const BenchmarksTab: Component = () => {
	return (
		<div class="h-full flex flex-col p-2">
			<div class="text-gray-500 text-center py-8">
				<p class="mb-2">Benchmarks Panel</p>
				<p class="text-xs">
					Run storage and scroll performance benchmarks.
					<br />
					Benchmarks will be migrated from /bench routes in a future update.
				</p>
				<div class="mt-4 flex gap-2 justify-center">
					<a
						href="/bench"
						target="_blank"
						class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
					>
						Storage Bench
					</a>
					<a
						href="/vfs-bench"
						target="_blank"
						class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
					>
						VFS Path Bench
					</a>
				</div>
			</div>
		</div>
	)
}
