import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-solid'
import { createSignal } from 'solid-js'
import { useScrollBenchmark } from '../hooks/useScrollBenchmark'
import { BENCHMARK_PRESETS } from './generateContent'

describe('Virtualizer Performance Benchmark', () => {
	let container: HTMLDivElement

	beforeEach(() => {
		container = document.createElement('div')
		container.style.cssText = `
            width: 800px;
            height: 600px;
            position: fixed;
            top: 0;
            left: 0;
        `
		document.body.appendChild(container)
	})

	afterEach(() => {
		container.remove()
	})

	const BenchmarkComponent = (props: {
		config: { lines: number; charsPerLine: number }
		onScrollEl: (el: HTMLDivElement) => void
	}) => {
		const [scrollEl, setScrollEl] = createSignal<HTMLDivElement | null>(null)

		useScrollBenchmark({ scrollElement: scrollEl })

		return (
			<div
				ref={(el) => {
					setScrollEl(el)
					props.onScrollEl(el)
				}}
				style={{ width: '100%', height: '100%', overflow: 'auto' }}
			>
				<div
					style={{
						height: `${props.config.lines * 20}px`,
						width: `${props.config.charsPerLine * 8}px`,
					}}
				/>
			</div>
		)
	}

	it('runs default phases (legacy behavior)', async () => {
		let scrollEl: HTMLDivElement | null = null
		const { unmount } = render(
			() => (
				<BenchmarkComponent
					config={BENCHMARK_PRESETS.normal}
					onScrollEl={(el) => (scrollEl = el)}
				/>
			),
			{ container }
		)

		await expect.poll(() => scrollEl).toBeTruthy()

		const results = await window.scrollBenchmark?.()
		expect(results).toBeDefined()

		// Default runs vertical phases
		expect(results?.down.frames).toBeGreaterThan(0)
		expect(results?.up.frames).toBeGreaterThan(0)
		expect(results?.jumpV.frames).toBeGreaterThan(0)

		// No horizontal by default
		expect(results?.right.frames).toBe(0)

		unmount()
	}, 60_000)

	it('runs requested specific phases', async () => {
		let scrollEl: HTMLDivElement | null = null
		const { unmount } = render(
			() => (
				<BenchmarkComponent
					config={BENCHMARK_PRESETS.normal}
					onScrollEl={(el) => (scrollEl = el)}
				/>
			),
			{ container }
		)

		await expect.poll(() => scrollEl).toBeTruthy()

		// Request only random jump
		const results = await window.scrollBenchmark?.({ phases: ['jumpV'] })

		expect(results?.jumpV.frames).toBeGreaterThan(0)
		expect(results?.down.frames).toBe(0)
		expect(results?.up.frames).toBe(0)

		unmount()
	}, 60_000)

	it('runs horizontal phases when requested (wide file)', async () => {
		let scrollEl: HTMLDivElement | null = null
		const { unmount } = render(
			() => (
				<BenchmarkComponent
					config={BENCHMARK_PRESETS.wide}
					onScrollEl={(el) => (scrollEl = el)}
				/>
			),
			{ container }
		)

		await expect.poll(() => scrollEl).toBeTruthy()

		const results = await window.scrollBenchmark?.({
			phases: ['right', 'left'],
		})

		expect(results?.right.frames).toBeGreaterThan(0)
		expect(results?.left.frames).toBeGreaterThan(0)
		expect(results?.down.frames).toBe(0)

		unmount()
	}, 60_000)
})
