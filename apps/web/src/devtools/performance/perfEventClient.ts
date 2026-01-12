import { EventClient } from '@tanstack/devtools-event-client'
import type { PerfRecord, PerfSummary, PerfBreakdownEntry } from '@repo/perf'

/**
 * Event map for performance devtools
 * Keys follow pattern: {pluginId}:{eventSuffix}
 */
type PerfEventMap = {
	'vibe-perf:record': PerfRecord
	'vibe-perf:summary': PerfSummary[]
	'vibe-perf:history': PerfRecord[]
	'vibe-perf:trace-start': { name: string; meta?: Record<string, unknown> }
	'vibe-perf:trace-mark': { name: string; label: string; duration: number }
	'vibe-perf:trace-end': {
		name: string
		totalDuration: number
		breakdown: PerfBreakdownEntry[]
	}
	'vibe-perf:clear': void
}

/**
 * Performance event client for communicating with TanStack Devtools
 */
class PerfEventClient extends EventClient<PerfEventMap> {
	constructor() {
		super({
			pluginId: 'vibe-perf',
			debug: import.meta.env.DEV,
		})
	}
}

export const perfEventClient = new PerfEventClient()
