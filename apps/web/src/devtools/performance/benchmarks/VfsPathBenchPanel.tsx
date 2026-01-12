import { createSignal, Show, type Component } from 'solid-js'
import { VfsPathBenchDashboard } from '~/bench/VfsPathBenchDashboard'

/**
 * VFS Path benchmark panel for devtools
 * Embeds the existing VfsPathBenchDashboard with adapted styling
 */
export const VfsPathBenchPanel: Component = () => {
	const [isRunning, setIsRunning] = createSignal(false)

	return (
		<div class="h-full overflow-auto">
			<Show
				when={isRunning()}
				fallback={
					<div class="flex flex-col items-center justify-center h-full gap-4 p-4">
						<p class="text-muted-foreground text-center">
							VFS path resolution benchmark measuring handle acquisition and
							directory traversal
						</p>
						<button
							class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
							onClick={() => setIsRunning(true)}
						>
							Run VFS Path Benchmark
						</button>
						<p class="text-xs text-muted-foreground">
							Or open{' '}
							<a href="/vfs-bench" target="_blank" class="underline">
								/vfs-bench
							</a>{' '}
							in a new tab for full view
						</p>
					</div>
				}
			>
				<div class="[&>div]:min-h-0 [&>div]:h-full [&>div]:p-2 [&_.mx-auto]:max-w-none [&_header]:hidden">
					<VfsPathBenchDashboard />
				</div>
			</Show>
		</div>
	)
}
