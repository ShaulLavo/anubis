import { wrap, type Remote } from 'comlink'
import type { SqliteWorkerApi } from './sqlite'

const worker = new Worker(new URL('./sqlite.ts', import.meta.url), {
	type: 'module',
})

export const sqliteApi: Remote<SqliteWorkerApi> = wrap<SqliteWorkerApi>(worker)

export const initSqlite = () => sqliteApi.init()

import type { InArgs } from 'sqlite-wasm/client'

export const runSqliteQuery = <T = Record<string, unknown>>(
	sql: string,
	params?: Record<string, unknown> | unknown[]
) =>
	sqliteApi.run(sql, params as InArgs) as Promise<{
		columns: string[]
		rows: T[]
	}>

export const execSqliteQuery = (sql: string) => sqliteApi.exec(sql)

export const resetSqlite = () => sqliteApi.reset()
