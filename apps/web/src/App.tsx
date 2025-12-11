import { type Component, onCleanup, onMount } from 'solid-js'
import Main from './Main'
import { Providers } from './Providers'
import { disposeTreeSitterWorker } from './treeSitter/workerClient'
import { runStoreBenchmarks } from './bench/runStoreBenchmarks'

const App: Component = () => {
	onMount(() => {
		void runStoreBenchmarks()
	})

	onCleanup(() => {
		void disposeTreeSitterWorker()
	})
	return (
		<Providers>
			<Main />
		</Providers>
	)
}

export default App
