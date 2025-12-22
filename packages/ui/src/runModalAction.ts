import type { ModalAction } from './createModalStore'
import type { createModalStore } from './createModalStore'
import { loggers } from '@repo/logger'

const log = loggers.app.withTag('modal')

type ModalStore = ReturnType<typeof createModalStore>

const isPromise = (value: unknown): value is Promise<unknown> => {
	if (!value || typeof value !== 'object') return false
	return (
		'then' in value && typeof (value as { then?: unknown }).then === 'function'
	)
}

const runModalAction = (store: ModalStore, action: ModalAction, id: string) => {
	try {
		log.info('action', { id, actionId: action.id })
		const result = action.onPress?.()
		const shouldAutoClose = action.autoClose !== false
		if (isPromise(result)) {
			void result
				.then(() => {
					if (shouldAutoClose) {
						store.dismiss(id)
					}
				})
				.catch((error) => {
					log.error('action failed', error)
					if (shouldAutoClose) {
						store.dismiss(id)
					}
				})
			if (!shouldAutoClose) return
			return
		}
		if (!shouldAutoClose) return
		store.dismiss(id)
	} catch (error) {
		log.error('action failed', error)
	}
}

export { runModalAction }
