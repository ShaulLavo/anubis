export { Editor } from './components/Editor'
export type * from './types'
export * from './theme/bracketColors'
export * from './utils/magicMove'

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
