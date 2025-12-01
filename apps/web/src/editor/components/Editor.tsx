import { Show, createMemo } from 'solid-js'
import { BinaryFileViewer } from '../../components/BinaryFileViewer'
import { TextFileEditor } from './TextFileEditor'
import type { EditorProps } from '../types'

export const Editor = (props: EditorProps) => {
	const isBinary = createMemo(() => props.stats()?.contentKind === 'binary')

	return (
		<Show
			when={props.isFileSelected()}
			fallback={
				<p class="mt-2 text-sm text-zinc-500">
					Select a file to view its contents. Click folders to toggle
					visibility.
				</p>
			}
		>
			<Show when={isBinary()} fallback={<TextFileEditor {...props} />}>
				<BinaryFileViewer
					data={props.previewBytes ?? (() => undefined)}
					stats={props.stats}
					fontSize={props.fontSize}
					fontFamily={props.fontFamily}
				/>
			</Show>
		</Show>
	)
}
