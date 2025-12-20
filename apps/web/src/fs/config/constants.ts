import type { FsSource } from '../types'

export const OPFS_ROOT_NAME = 'root' as const
const isTest =
	(import.meta as any).env?.VITEST ||
	(import.meta as any).env?.MODE === 'test' ||
	(globalThis as any).vTest

export const DEFAULT_SOURCE: FsSource = isTest ? 'memory' : 'local'
