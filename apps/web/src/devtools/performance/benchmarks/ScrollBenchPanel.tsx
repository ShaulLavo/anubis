import { createSignal, Show, For, type Component } from 'solid-js'

// Types from @repo/code-editor/editor/hooks/useScrollBenchmark
type BenchmarkPhase = 'down' | 'up' | 'jumpV' | 'right' | 'left' | 'jumpH'

type PhaseStats = {
	duration: number
	frames: number
	fps: number
}

type BenchmarkResults = {
	[K in BenchmarkPhase]: PhaseStats
}

// ScrollBenchmarkBuilder type matches window.scrollBench from @repo/code-editor
type ScrollBenchmarkBuilder = {
	down(): ScrollBenchmarkBuilder
	up(): ScrollBenchmarkBuilder
	vjump(): ScrollBenchmarkBuilder
	right(): ScrollBenchmarkBuilder
	left(): ScrollBenchmarkBuilder
	hjump(): ScrollBenchmarkBuilder
	vertical(): ScrollBenchmarkBuilder
	horizontal(): ScrollBenchmarkBuilder
	all(): ScrollBenchmarkBuilder
	start(): Promise<BenchmarkResults>
	run(): Promise<BenchmarkResults>
}

const formatMs = (ms: number): string => {
	if (ms < 1) return `${ms.toFixed(3)}ms`
	return `${ms.toFixed(2)}ms`
}

const PHASE_LABELS: Record<BenchmarkPhase, string> = {
	down: 'Scroll Down',
	up: 'Scroll Up',
	jumpV: 'Random Jump (V)',
	right: 'Scroll Right',
	left: 'Scroll Left',
	jumpH: 'Random Jump (H)',
}

const ResultsTable: Component<{ results: BenchmarkResults }> = (props) => {
	const phases = () =>
		Object.entries(props.results).filter(
			([_, stats]) => stats.frames > 0
		) as [BenchmarkPhase, PhaseStats][]

	return (
		<div class="overflow-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="text-left py-2 px-3 font-medium text-muted-foreground">
							Phase
						</th>
						<th class="text-right py-2 px-3 font-medium text-muted-foreground">
							Duration
						</th>
						<th class="text-right py-2 px-3 font-medium text-muted-foreground">
							Frames
						</th>
						<th class="text-right py-2 px-3 font-medium text-muted-foreground">
							FPS
						</th>
					</tr>
				</thead>
				<tbody>
					<For each={phases()}>
						{([phase, stats]) => (
							<tr class="border-b border-border/50 hover:bg-muted/30">
								<td class="py-2 px-3 text-foreground">
									{PHASE_LABELS[phase]}
								</td>
								<td class="py-2 px-3 text-right font-mono text-muted-foreground">
									{formatMs(stats.duration)}
								</td>
								<td class="py-2 px-3 text-right font-mono text-muted-foreground">
									{stats.frames}
								</td>
								<td class="py-2 px-3 text-right font-mono">
									<span
										class={
											stats.fps >= 60
												? 'text-emerald-500'
												: stats.fps >= 30
													? 'text-amber-500'
													: 'text-rose-500'
										}
									>
										{stats.fps}
									</span>
								</td>
							</tr>
						)}
					</For>
				</tbody>
			</table>
		</div>
	)
}

/**
 * Scroll benchmark panel for devtools
 * Runs scroll FPS measurements on the active editor
 */
export const ScrollBenchPanel: Component = () => {
	const [isRunning, setIsRunning] = createSignal(false)
	const [results, setResults] = createSignal<BenchmarkResults | null>(null)
	const [error, setError] = createSignal<string | null>(null)
	const [includeHorizontal, setIncludeHorizontal] = createSignal(false)

	const runBenchmark = async () => {
		setError(null)
		setResults(null)
		setIsRunning(true)

		try {
			if (!window.scrollBench) {
				throw new Error(
					'No active editor found. Open a file in the editor first.'
				)
			}

			const builder = window.scrollBench()
			const benchResults = includeHorizontal()
				? await builder.all().start()
				: await builder.vertical().start()

			setResults(benchResults)
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			setIsRunning(false)
		}
	}

	return (
		<div class="h-full overflow-auto p-4">
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-sm font-medium text-foreground">Scroll FPS Test</h3>
						<p class="text-xs text-muted-foreground mt-1">
							Measures scroll rendering performance in the active editor
						</p>
					</div>
					<button
						class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
						onClick={runBenchmark}
						disabled={isRunning()}
					>
						{isRunning() ? 'Running...' : 'Run Test'}
					</button>
				</div>

				<label class="flex items-center gap-2 text-sm text-muted-foreground">
					<input
						type="checkbox"
						checked={includeHorizontal()}
						onChange={(e) => setIncludeHorizontal(e.currentTarget.checked)}
						class="rounded border-border"
					/>
					Include horizontal scroll tests
				</label>

				<Show when={error()}>
					<div class="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
						{error()}
					</div>
				</Show>

				<Show when={results()}>
					<div class="border border-border rounded-md overflow-hidden">
						<ResultsTable results={results()!} />
					</div>
				</Show>

				<Show when={!results() && !isRunning() && !error()}>
					<div class="text-center py-8 text-muted-foreground text-sm">
						<p>Open a file in the editor, then click "Run Test"</p>
						<p class="text-xs mt-2">
							Or use{' '}
							<code class="bg-muted px-1.5 py-0.5 rounded font-mono">
								scrollBench().all().start()
							</code>{' '}
							in console
						</p>
					</div>
				</Show>
			</div>
		</div>
	)
}
