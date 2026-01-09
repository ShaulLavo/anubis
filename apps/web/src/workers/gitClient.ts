import { wrap, proxy, type Remote } from 'comlink'
import type {
	GitCloneRequest,
	GitWorkerApi,
	GitWorkerConfig,
} from '../git/types'

const worker = new Worker(new URL('./git.worker.ts', import.meta.url), {
	type: 'module',
})

export const gitApi: Remote<GitWorkerApi> = wrap<GitWorkerApi>(worker)

export const initGitWorker = (config?: GitWorkerConfig) => gitApi.init(config)

export const prepareGitCloneRequest = (
	request: GitCloneRequest
): GitCloneRequest => ({
	...request,
	onProgress: request.onProgress ? proxy(request.onProgress) : undefined,
	onFile: request.onFile ? proxy(request.onFile) : undefined,
})
