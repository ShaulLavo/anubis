import { For, Show, type Component } from 'solid-js'
import type { PerfRecord } from '@repo/perf'
import { Duration } from '../../shared/Duration'

interface TimelineTabProps {
	records: PerfRecord[]
}

/**
 * Timeline tab showing live operation waterfall
 */
export const TimelineTab: Component<TimelineTabProps> = (props) => {
	return (
		<div class="h-full flex flex-col p-2">
			<div class="flex items-center justify-between mb-2">
				<span class="text-sm text-muted-foreground">
					{props.records.length} operations
				</span>
			</div>

			<div class="flex-1 overflow-auto">
				<Show
					when={props.records.length > 0}
					fallback={
						<div class="text-muted-foreground text-center py-8">
							No operations recorded yet. Interact with the app to see
							performance data.
						</div>
					}
				>
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-background">
							<tr class="text-muted-foreground text-left">
								<th class="px-2 py-1">Operation</th>
								<th class="px-2 py-1 text-right">Duration</th>
								<th class="px-2 py-1 text-right">Time</th>
							</tr>
						</thead>
						<tbody>
							<For each={props.records.slice().reverse()}>
								{(record) => (
									<tr class="border-b border-border hover:bg-muted/50">
										<td class="px-2 py-1 font-mono text-foreground">
											{record.name}
										</td>
										<td class="px-2 py-1 text-right">
											<Duration ms={record.duration} />
										</td>
										<td class="px-2 py-1 text-right text-muted-foreground text-xs">
											{new Date(record.timestamp).toLocaleTimeString()}
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
