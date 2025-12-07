export type TreeSitterWorkerApi = {
	init(): Promise<void>
	parse(source: string): Promise<string | undefined>
	dispose(): Promise<void>
}
