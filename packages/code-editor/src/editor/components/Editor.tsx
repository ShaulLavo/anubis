import type { EditorProps } from '../types'
import { CursorProvider } from '../cursor'
import { HistoryProvider } from '../history'
import { TextEditorView } from './TextEditorView'

export const Editor = (props: EditorProps) => {
	console.log('[Editor] render', {
		filePath: props.document.filePath(),
		hasOnScrollPositionChange: !!props.onScrollPositionChange,
		onScrollPositionChangeType: typeof props.onScrollPositionChange,
	})
	return (
		<CursorProvider
			filePath={props.document.filePath}
			isFileSelected={props.isFileSelected}
			content={props.document.content}
			pieceTable={props.document.pieceTable}
			precomputedLineStarts={props.precomputedLineStarts}
			contentVersion={props.contentVersion}
		>
			<HistoryProvider document={props.document}>
				<TextEditorView {...props} />
			</HistoryProvider>
		</CursorProvider>
	)
}
