import { describe, it, expect } from 'vitest'
import { streamChunksWithOverlap } from '../chunkReader'

describe('chunkReader', () => {
	it('should process chunks with overlap correctly', async () => {
		const chunkSize = 10
		const overlapSize = 5
		const data = new Uint8Array(20).map((_, i) => i)

		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(data)
				controller.close()
			},
		})

		const chunks = []
		for await (const chunk of streamChunksWithOverlap(
			stream,
			chunkSize,
			overlapSize
		)) {
			chunks.push(chunk)
		}

		expect(chunks.length).toBe(4)
		expect(chunks[0]!.chunk).toEqual(
			new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
		)
		expect(chunks[1]!.chunk).toEqual(
			new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
		)
		expect(chunks[2]!.chunk).toEqual(
			new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
		)
		expect(chunks[3]!.chunk).toEqual(new Uint8Array([15, 16, 17, 18, 19]))
	})

	it('should prevent infinite loop by clamping overlapSize', async () => {
		const chunkSize = 10
		const overlapSize = 10
		const data = new Uint8Array(20).map((_, i) => i)

		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(data)
				controller.close()
			},
		})

		const chunks = []
		let count = 0
		for await (const chunk of streamChunksWithOverlap(
			stream,
			chunkSize,
			overlapSize
		)) {
			chunks.push(chunk)
			count++
			if (count > 100) throw new Error('Infinite loop detected')
		}

		expect(chunks.length).toBe(12)
		expect(chunks[0]!.chunk).toEqual(
			new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
		)
		expect(chunks[1]!.chunk).toEqual(
			new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
		)
		expect(chunks[2]!.chunk).toEqual(
			new Uint8Array([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
		)
	})
})
