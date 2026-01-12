import { createSignal, onMount, onCleanup, For, Show, type Component } from 'solid-js'
import { getSummary, type PerfSummary } from '@repo/perf'
import { Duration } from '../../shared/Duration'

/**
 * Summary tab showing aggregated statistics
 */
export const SummaryTab: Component = () => {
	const [summary, setSummary] = createSignal<PerfSummary[]>([])

	// Refresh summary every second
	onMount(() => {
		const refresh = () => setSummary(getSummary())
		refresh()
		const interval = setInterval(refresh, 1000)
		onCleanup(() => clearInterval(interval))
	})

	return (
		<div class="h-full flex flex-col p-2">
			<div class="flex items-center justify-between mb-2">
				<span class="text-sm text-gray-400">
					{summary().length} operation types
				</span>
			</div>

			<div class="flex-1 overflow-auto">
				<Show
					when={summary().length > 0}
					fallback={
						<div class="text-gray-500 text-center py-8">
							No performance data collected yet.
						</div>
					}
				>
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-gray-900">
							<tr class="text-gray-400 text-left">
								<th class="px-2 py-1">Operation</th>
								<th class="px-2 py-1 text-right">Count</th>
								<th class="px-2 py-1 text-right">Avg</th>
								<th class="px-2 py-1 text-right">Min</th>
								<th class="px-2 py-1 text-right">Max</th>
								<th class="px-2 py-1 text-right">P95</th>
								<th class="px-2 py-1 text-right">Total</th>
							</tr>
						</thead>
						<tbody>
							<For each={summary()}>
								{(item) => (
									<tr class="border-b border-gray-800 hover:bg-gray-800/50">
										<td class="px-2 py-1 font-mono text-gray-200">
											{item.name}
										</td>
										<td class="px-2 py-1 text-right text-gray-400">
											{item.count}
										</td>
										<td class="px-2 py-1 text-right">
											<Duration ms={item.avgDuration} />
										</td>
										<td class="px-2 py-1 text-right">
											<Duration ms={item.minDuration} />
										</td>
										<td class="px-2 py-1 text-right">
											<Duration ms={item.maxDuration} />
										</td>
										<td class="px-2 py-1 text-right">
											<Duration ms={item.p95Duration} />
										</td>
										<td class="px-2 py-1 text-right">
											<Duration ms={item.totalDuration} />
										</td>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</Show>
			</div>
		</div>
	)
}
