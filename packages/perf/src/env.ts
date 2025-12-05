import { z } from 'zod'

type EnvRecord = Record<string, string | undefined>

const getProcessEnv = (): EnvRecord => {
	if (typeof globalThis === 'undefined') return {}
	const maybeProcess = (globalThis as { process?: { env?: EnvRecord } }).process
	return maybeProcess?.env ?? {}
}

const getImportMetaEnv = (): EnvRecord => {
	try {
		return ((import.meta as { env?: EnvRecord })?.env) ?? {}
	} catch {
		return {}
	}
}

const envSchema = z.object({
	PERF_TRACKING_ENABLED: z.coerce.boolean().optional(),
	VITE_PERF_TRACKING: z.coerce.boolean().optional()
})

const envData = envSchema.parse({
	...getImportMetaEnv(),
	...getProcessEnv()
})

export const perfEnv = {
	perfTrackingEnabled:
		envData.PERF_TRACKING_ENABLED ?? envData.VITE_PERF_TRACKING ?? true
}

export type PerfEnv = typeof perfEnv
