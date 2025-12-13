export type TableInfo = {
	cid: number
	name: string
	type: string
	notnull: number
	dflt_value: unknown
	pk: number
}

export type EditingCell<T = unknown> = {
	row: Record<string, T>
	col: string
	value: T
}
