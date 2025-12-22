export { Editor } from './components/Editor'
export type * from './types'
export type * from './types/visibleContentCache'
export type { TextRun } from './line/utils/textRuns'
export * from './theme/bracketColors'

// Re-export lexer API from @repo/lexer
export {
	Lexer,
	LexState,
	parseScmQuery,
	mergeScmRules,
	type Token,
	type LineState,
	type TokenizeResult,
	type BracketInfo,
	type ScmRules,
	type LineHighlightSegment,
} from '@repo/lexer'
