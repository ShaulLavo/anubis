import { expose } from 'comlink'
import { Language, Parser } from 'web-tree-sitter'
import type { TreeSitterWorkerApi } from './treeSitterWorkerTypes'

let parserInstance: Parser | null = null
let parserInitPromise: Promise<void> | null = null

const locateWasm = () => '/tree-sitter/tree-sitter.wasm'
const javascriptGrammarPath = '/tree-sitter/tree-sitter-javascript.wasm'

const ensureParser = async () => {
	if (!parserInitPromise) {
		parserInitPromise = (async () => {
			await Parser.init({ locateFile: locateWasm })
			const parser = new Parser()
			const jsLanguage = await Language.load(javascriptGrammarPath)
			parser.setLanguage(jsLanguage)
			parserInstance = parser
		})().catch(error => {
			parserInitPromise = null
			throw error
		})
	}

	await parserInitPromise
	return parserInstance
}

const api: TreeSitterWorkerApi = {
	async init() {
		await ensureParser()
	},
	async parse(source) {
		const parser = await ensureParser()
		const tree = parser?.parse(source)
		return tree?.rootNode.toString()
	},
	async dispose() {
		parserInstance?.delete()
		parserInstance = null
		parserInitPromise = null
	}
}

expose(api)
