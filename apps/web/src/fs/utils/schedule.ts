export const scheduleMicrotask = (fn: () => void) => {
	if (typeof queueMicrotask === 'function') {
		queueMicrotask(fn)
	} else {
		Promise.resolve().then(fn)
	}
}

/**
 * Schedule work that yields to the browser between tasks.
 * Unlike microtasks, this allows the browser to process events (wheel, click, etc.)
 * between each scheduled callback.
 */
export const scheduleYielding = (fn: () => void) => {
	// Use setTimeout(0) to yield to the event loop
	// This allows browser to process user input between updates
	setTimeout(fn, 0)
}

/**
 * Batch multiple updates and apply them in a single frame.
 * Collects callbacks and flushes them in chunks using requestAnimationFrame,
 * yielding between chunks to keep the UI responsive.
 */
export const createBatchScheduler = <T>(
	apply: (items: T[]) => void,
	options: { maxBatchSize?: number; flushDelayMs?: number } = {}
) => {
	const { maxBatchSize = 50, flushDelayMs = 16 } = options
	const pending: T[] = []
	let scheduled = false

	const flush = () => {
		if (pending.length === 0) {
			scheduled = false
			return
		}

		// Take a chunk
		const chunk = pending.splice(0, maxBatchSize)
		apply(chunk)

		// If more pending, schedule next chunk with yield
		if (pending.length > 0) {
			setTimeout(flush, flushDelayMs)
		} else {
			scheduled = false
		}
	}

	return {
		add: (item: T) => {
			pending.push(item)
			if (!scheduled) {
				scheduled = true
				// Initial delay to batch rapid-fire calls
				setTimeout(flush, flushDelayMs)
			}
		},
		flush: () => {
			// Force immediate flush of all pending items
			if (pending.length > 0) {
				const all = pending.splice(0)
				apply(all)
			}
			scheduled = false
		},
		get pendingCount() {
			return pending.length
		},
	}
}
