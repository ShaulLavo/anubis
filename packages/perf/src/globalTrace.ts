/**
 * Global trace for cross-component performance measurement.
 * Use startGlobalTrace('keystroke') at input, endGlobalTrace('keystroke') when render completes.
 */

type TraceData = {
	start: number
	markers: Array<{ label: string; elapsed: number }>
}

const globalTraces = new Map<string, TraceData>()

export const startGlobalTrace = (name: string): void => {
	globalTraces.set(name, { start: performance.now(), markers: [] })
}

export const markGlobalTrace = (name: string, label: string): void => {
	const trace = globalTraces.get(name)
	if (trace) {
		const elapsed = performance.now() - trace.start
		trace.markers.push({ label, elapsed })
	}
}

export const endGlobalTrace = (name: string, label = 'total'): number => {
	const trace = globalTraces.get(name)
	if (trace) {
		const duration = performance.now() - trace.start
		trace.markers.push({ label, elapsed: duration })

		// Build table data with deltas
		const tableData = trace.markers.map((m, i) => {
			const prev = i > 0 ? trace.markers[i - 1]!.elapsed : 0
			return {
				step: m.label,
				elapsed: `+${m.elapsed.toFixed(1)}ms`,
				delta: `${(m.elapsed - prev).toFixed(1)}ms`,
			}
		})

		console.table(tableData)
		globalTraces.delete(name)
		return duration
	}
	return 0
}

export const hasGlobalTrace = (name: string): boolean => {
	return globalTraces.has(name)
}
