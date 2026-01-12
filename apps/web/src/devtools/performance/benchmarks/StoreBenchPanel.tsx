import { createSignal, Show, type Component } from 'solid-js'
import { StoreBenchDashboard } from '~/bench/StoreBenchDashboard'

/**
 * Storage benchmark panel for devtools
 * Embeds the existing StoreBenchDashboard with adapted styling
 */
export const StoreBenchPanel: Component = () => {
	const [isRunning, setIsRunning] = createSignal(false)

	return (
		<div class="h-full overflow-auto">
			<Show
				when={isRunning()}
				fallback={
					<div class="flex flex-col items-center justify-center h-full gap-4 p-4">
						<p class="text-muted-foreground text-center">
							Storage adapter benchmark comparing OPFS async/sync + IndexedDB
						</p>
						<button
							class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
							onClick={() => setIsRunning(true)}
						>
							Run Storage Benchmark
						</button>
						<p class="text-xs text-muted-foreground">
							Or open{' '}
							<a href="/bench" target="_blank" class="underline">
								/bench
							</a>{' '}
							in a new tab for full view
						</p>
					</div>
				}
			>
				<div class="[&>div]:min-h-0 [&>div]:p-2 [&_.mx-auto]:max-w-none">
					<StoreBenchDashboard />
				</div>
			</Show>
		</div>
	)
}
