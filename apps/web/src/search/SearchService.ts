import {
	searchFiles,
	batchInsertFiles,
	resetSqlite,
	initSqlite,
} from '../workers/sqliteClient'
import type { SearchBackend, SearchResult, FileMetadata } from './types'

export class SearchService implements SearchBackend {
	async init(): Promise<void> {
		// The generic type in initSqlite returns version info, but the interface just returns void for now.
		await initSqlite()
	}

	async search(query: string): Promise<SearchResult[]> {
		return searchFiles(query)
	}

	async indexFiles(files: FileMetadata[]): Promise<void> {
		return batchInsertFiles(files)
	}

	async reset(): Promise<void> {
		return resetSqlite()
	}
}

export const searchService = new SearchService()
