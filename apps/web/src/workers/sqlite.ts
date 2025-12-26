import { logger } from '@repo/logger'
import * as Comlink from 'comlink'
import sqlite3InitModule, {
	type Database,
	type Sqlite3Static,
} from 'sqlite-wasm'
import {
	createClient,
	type Sqlite3Client,
	type Config,
	type InArgs,
} from 'sqlite-wasm/client'
import wasmUrl from 'sqlite-wasm/sqlite3.wasm?url'

const log = logger.withTag('sqlite').debug

let sqlite3: Sqlite3Static | null = null
let client: Sqlite3Client | null = null
let db: Database | null = null
let initPromise: Promise<{ version: string; opfsEnabled: boolean }> | null =
	null
let clientCofig: Config = { url: 'file:/vibe.sqlite3' }
const getClient = (): Sqlite3Client => {
	if (!client) {
		throw new Error('SQLite not initialized. Call init() first.')
	}
	return client
}

const performInit = async (): Promise<{
	version: string
	opfsEnabled: boolean
}> => {
	// Suppress verbose internal SQLite WASM logging (includes init messages sent to stderr)
	if (!sqlite3) {
		sqlite3 = await sqlite3InitModule({
			print: () => {},
			printErr: () => {},
			locateFile: (file: string) => {
				if (file.endsWith('.wasm')) return wasmUrl
				return file
			},
		})
	}

	const opfsEnabled = 'opfs' in sqlite3
	clientCofig = {
		url: opfsEnabled ? 'file:/vibe.sqlite3' : ':memory:',
	}
	;[client, db] = createClient(clientCofig, sqlite3)

	log(
		`[SQLite] v${sqlite3.version.libVersion} initialized. OPFS: ${opfsEnabled}, URL: ${clientCofig.url}`
	)

	return { version: sqlite3.version.libVersion, opfsEnabled }
}

const init = async (): Promise<{ version: string; opfsEnabled: boolean }> => {
	if (client && sqlite3) {
		return {
			version: sqlite3.version.libVersion,
			opfsEnabled: 'opfs' in sqlite3,
		}
	}
	if (!initPromise) {
		initPromise = performInit()
	}
	return initPromise
}

const exec = async (sql: string): Promise<void> => {
	await getClient().execute(sql)
}

const run = async <T = Record<string, unknown>>(
	sql: string,
	params?: InArgs
): Promise<{ columns: string[]; rows: T[] }> => {
	const result = await getClient().execute({
		sql,
		args: params,
	})

	const rows = result.rows.map((row) => {
		const obj: Record<string, unknown> = {}
		for (const col of result.columns) {
			const index = result.columns.indexOf(col)
			obj[col] = row[index]
		}
		return obj as T
	})

	return {
		columns: result.columns,
		rows,
	}
}

const reset = async (): Promise<void> => {
	// 1. Close the database connection
	if (db) {
		try {
			// @ts-expect-error - close might not be in the type definition but is available
			db.close()
		} catch (e) {
			log('[SQLite] Error closing DB:', e)
		}
		db = null
		client = null
	}

	// 2. Delete the OPFS file
	try {
		const root = await navigator.storage.getDirectory()
		await root.removeEntry('vibe.sqlite3')
		log('[SQLite] OPFS file deleted')
	} catch (e) {
		log('[SQLite] Error deleting OPFS file (might not exist):', e)
	}

	// 3. Re-initialize
	initPromise = null
	await performInit()
	log('[SQLite] Re-initialized')

	log('[SQLite] Database reset complete (clean state)')
}

const workerApi = {
	init,
	exec,
	run,
	reset,
}

export type SqliteWorkerApi = typeof workerApi

Comlink.expose(workerApi)
