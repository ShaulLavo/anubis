import { logger } from '@repo/logger'
import type { Sqlite3Client } from 'sqlite-wasm/client'
import type { FileMetadata, SearchResult } from '../search/types'

const log = logger.withTag('sqlite-search').debug

export const ensureSchema = async (client: Sqlite3Client) => {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS files (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			path TEXT UNIQUE NOT NULL,
			path_lc TEXT NOT NULL,
			basename_lc TEXT NOT NULL,
			basename_initials TEXT NOT NULL, 
			dir_lc TEXT NOT NULL,
			kind TEXT NOT NULL,
			recency INTEGER DEFAULT 0
		)
	`)

	try {
		const result = await client.execute('PRAGMA table_info(files)')
		// result.rows is array of arrays, result.columns is array of column names
		const nameIdx = result.columns.indexOf('name')
		if (nameIdx !== -1) {
			const hasInitials = result.rows.some(
				(row) => row[nameIdx] === 'basename_initials'
			)
			if (!hasInitials) {
				log('[SQLite] Migrating: Adding basename_initials column')
				await client.execute(
					"ALTER TABLE files ADD COLUMN basename_initials TEXT NOT NULL DEFAULT ''"
				)
			}
		}
	} catch (e) {
		log('[SQLite] Migration check failed', e)
	}

	await client.execute(
		'CREATE INDEX IF NOT EXISTS idx_files_path_lc ON files(path_lc)'
	)
	await client.execute(
		'CREATE INDEX IF NOT EXISTS idx_files_basename_lc ON files(basename_lc)'
	)
	await client.execute(
		'CREATE INDEX IF NOT EXISTS idx_files_basename_initials ON files(basename_initials)'
	)
}

const getInitials = (basename: string): string => {
	const name = basename.split('.').shift() ?? ''
	if (!name) return ''

	const parts = name.split(/[^a-zA-Z0-9]|(?=[A-Z])/)

	return parts
		.filter((p) => p.length > 0)
		.map((p) => p.charAt(0).toLowerCase())
		.join('')
}

export const batchInsertFiles = async (
	client: Sqlite3Client,
	files: FileMetadata[]
): Promise<void> => {
	if (files.length === 0) return

	const placeholders = files.map(() => '(?, ?, ?, ?, ?, ?)').join(',')
	const args: (string | number)[] = []

	for (const file of files) {
		const path_lc = file.path.toLowerCase()
		const basename = file.path.split('/').pop() ?? ''
		const basename_lc = basename.toLowerCase()
		const basename_initials = getInitials(basename)

		const dir_lc = file.path
			.substring(0, file.path.lastIndexOf('/'))
			.toLowerCase()

		args.push(
			file.path,
			path_lc,
			basename_lc,
			basename_initials,
			dir_lc,
			file.kind
		)
	}

	try {
		await client.execute({
			sql: `INSERT OR IGNORE INTO files (path, path_lc, basename_lc, basename_initials, dir_lc, kind) VALUES ${placeholders}`,
			args,
		})
	} catch (e) {
		log('Batch insert failed', e)
		throw e
	}
}

const SEARCH_PREFIX_SQL = `
	SELECT id, path, kind, recency 
	FROM files 
	WHERE (basename_lc LIKE ? OR basename_initials LIKE ?)
	AND kind = ?
	ORDER BY recency DESC, path_lc ASC
	LIMIT 1000
`

const SEARCH_FUZZY_SQL = `
	SELECT id, path, kind, recency 
	FROM files 
	WHERE (path_lc LIKE ? OR basename_initials LIKE ?)
	AND kind = ?
	ORDER BY 
		CASE 
			WHEN basename_lc LIKE ? THEN 1
			WHEN basename_initials LIKE ? THEN 2
			ELSE 3
		END,
		recency DESC, 
		length(path_lc) ASC
	LIMIT 1000
`

export type SearchOptions = {
	kind?: 'file' | 'dir'
}

export const searchFiles = async (
	client: Sqlite3Client,
	query: string,
	options: SearchOptions = {}
): Promise<SearchResult[]> => {
	const qLower = query.toLowerCase()
	const kind = options.kind ?? 'file' // Default to files only

	const usePrefix = qLower.length <= 1
	const pattern = usePrefix
		? `${qLower}%`
		: '%' + qLower.split('').join('%') + '%'
	const prefixPattern = `${qLower}%`

	const result = await client.execute({
		sql: usePrefix ? SEARCH_PREFIX_SQL : SEARCH_FUZZY_SQL,
		args: usePrefix
			? [prefixPattern, prefixPattern, kind]
			: [pattern, prefixPattern, kind, prefixPattern, prefixPattern],
	})

	return result.rows.map(
		(row) =>
			({
				id: row[0],
				path: row[1],
				kind: row[2],
				recency: row[3],
			}) as SearchResult
	)
}
