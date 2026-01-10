import type {
	DocumentIncrementalEdit,
	TextEditorDocument,
} from '@repo/code-editor'
import type { ParseResult } from '@repo/utils'
import { getEditCharDelta, getEditLineDelta } from '@repo/utils/highlightShift'
import { batch, createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { FsActions } from '../context/FsContext'
import { sendIncrementalTreeEdit } from '../../treeSitter/incrementalEdits'

type UseEditorDocumentParams = {
	filePath: TextEditorDocument['filePath']
	content: TextEditorDocument['content']
	pieceTable: TextEditorDocument['pieceTable']
	updatePieceTable: TextEditorDocument['updatePieceTable']
	isFileSelected: Accessor<boolean>
	isSelectedFileLoading: Accessor<boolean>
	isLoading: Accessor<boolean>
	stats: Accessor<ParseResult | undefined>
	applyHighlightOffset: FsActions['applySelectedFileHighlightOffset']
	updateHighlights: FsActions['updateSelectedFileHighlights']
	updateFolds: FsActions['updateSelectedFileFolds']
	updateBrackets: FsActions['updateSelectedFileBrackets']
	updateErrors: FsActions['updateSelectedFileErrors']
}

const buildHighlightTransform = (edit: DocumentIncrementalEdit) => {
	return {
		charDelta: getEditCharDelta(edit),
		lineDelta: getEditLineDelta(edit),
		fromCharIndex: edit.startIndex,
		fromLineRow: edit.startPosition.row,
		oldEndRow: edit.oldEndPosition.row,
		newEndRow: edit.newEndPosition.row,
		oldEndIndex: edit.oldEndIndex,
		newEndIndex: edit.newEndIndex,
	}
}

export const useEditorDocument = (params: UseEditorDocumentParams) => {
	const [documentVersion, setDocumentVersion] = createSignal(0)

	const isBinary = () => params.stats()?.contentKind === 'binary'
	const isEditable = () =>
		params.isFileSelected() &&
		!params.isSelectedFileLoading() &&
		!params.isLoading()

	const applyIncrementalEdit = (edit: DocumentIncrementalEdit) => {
		if (isBinary()) return

		const path = params.filePath()
		if (!path) return

		const parsePromise = sendIncrementalTreeEdit(path, edit)
		if (!parsePromise) return

		params.applyHighlightOffset(buildHighlightTransform(edit))

		void parsePromise.then((result) => {
			if (!result) return
			if (path !== params.filePath()) return

			batch(() => {
				params.updateHighlights(result.captures)
				params.updateFolds(result.folds)
				params.updateBrackets(result.brackets)
				params.updateErrors(result.errors)
				setDocumentVersion((value) => value + 1)
			})
		})
	}

	const editorDocument: TextEditorDocument = {
		filePath: params.filePath,
		content: params.content,
		pieceTable: params.pieceTable,
		updatePieceTable: params.updatePieceTable,
		isEditable,
		applyIncrementalEdit,
	}

	return { editorDocument, documentVersion }
}
