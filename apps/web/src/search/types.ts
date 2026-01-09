export interface SearchResult {
	id: number
	path: string
	kind: string
	recency: number
}

export interface FileMetadata {
	path: string
	kind: string
}

export interface SearchBackend {
	init(): Promise<void>
	search(query: string): Promise<SearchResult[]>
	indexFiles(files: FileMetadata[]): Promise<void>
	reset(): Promise<void>
}
