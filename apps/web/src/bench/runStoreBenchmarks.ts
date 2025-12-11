type Scenario = {
	name: string
	items: number
	valueBytes: number
	order: 'sequential' | 'random'
}

type ScenarioResult = {
	store: string
	items: number
	valueBytes: number
	writeMs: number
	readMs: number
	removeMs: number
	totalMs: number
}

type WorkerResultsMessage = {
	type: 'results'
	payload: { scenario: Scenario; results: ScenarioResult[] }[]
}

type WorkerSkippedMessage = { type: 'skipped'; reason?: string }

type WorkerErrorMessage = { type: 'error'; error: string }

type WorkerMessage = WorkerResultsMessage | WorkerSkippedMessage | WorkerErrorMessage

const formatNumber = (value: number, digits = 2) => Number(value.toFixed(digits))

const logScenarioResults = (scenario: Scenario, results: ScenarioResult[]) => {
	const rows = results.map(result => ({
		store: result.store,
		items: result.items,
		valueBytes: result.valueBytes,
		writeMs: formatNumber(result.writeMs),
		readMs: formatNumber(result.readMs),
		removeMs: formatNumber(result.removeMs),
		totalMs: formatNumber(result.totalMs)
	}))

	const winner = rows.reduce((best, current) =>
		current.totalMs < best.totalMs ? current : best
	)

	console.group(
		`[store bench] ${scenario.name} — items=${scenario.items} valueBytes=${scenario.valueBytes}`
	)
	console.table(rows)
	console.info(
		`👑 Winner: ${winner.store} (${winner.totalMs.toFixed(2)} ms total)`
	)
	console.groupEnd()
}

export const runStoreBenchmarks = async (): Promise<void> => {
	if (typeof Worker === 'undefined') {
		console.info('[store bench] skipped: Worker API is unavailable')
		return
	}

	try {
		const worker = new Worker(
			new URL('./vfsStoreBench.worker.ts', import.meta.url),
			{ type: 'module' }
		)

		const scenarioResults = await new Promise<
			{ scenario: Scenario; results: ScenarioResult[] }[]
		>((resolve, reject) => {
			worker.onmessage = event => {
				const message = event.data as WorkerMessage
				if (!message || typeof message !== 'object') return

				if (message.type === 'results') {
					resolve(message.payload)
					worker.terminate()
					return
				}

				if (message.type === 'skipped') {
					console.info(
						`[store bench] skipped: ${message.reason ?? 'no available adapters'}`
					)
					resolve([])
					worker.terminate()
					return
				}

				if (message.type === 'error') {
					reject(new Error(message.error))
					worker.terminate()
				}
			}

			worker.onerror = error => {
				reject(error.error ?? error.message ?? error)
				worker.terminate()
			}

			worker.postMessage({ type: 'run' })
		})

		if (scenarioResults.length === 0) return

		for (const { scenario, results } of scenarioResults) {
			if (results.length === 0) {
				console.info(
					`[store bench] ${scenario.name} skipped: no runnable adapters`
				)
				continue
			}
			logScenarioResults(scenario, results)
		}
	} catch (error) {
		console.error('[store bench] failed', error)
	}
}
