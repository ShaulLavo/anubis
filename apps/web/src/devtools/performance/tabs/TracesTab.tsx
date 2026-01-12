import { type Component } from 'solid-js'

/**
 * Traces tab for globalTrace visualization
 * TODO: Implement trace visualization
 */
export const TracesTab: Component = () => {
	return (
		<div class="h-full flex flex-col p-2">
			<div class="text-gray-500 text-center py-8">
				<p class="mb-2">Global Trace Visualization</p>
				<p class="text-xs">
					Traces will appear here when globalTrace is used.
					<br />
					Use <code class="bg-gray-800 px-1 rounded">startGlobalTrace()</code>,{' '}
					<code class="bg-gray-800 px-1 rounded">markGlobalTrace()</code>, and{' '}
					<code class="bg-gray-800 px-1 rounded">endGlobalTrace()</code> to track
					cross-component operations.
				</p>
			</div>
		</div>
	)
}
