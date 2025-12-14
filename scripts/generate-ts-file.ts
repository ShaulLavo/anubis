#!/usr/bin/env node
import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
const formatBytes = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes < 0) return '0 Bytes'
	if (bytes === 0) return '0 Bytes'

	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const
	const maxIndex = units.length - 1
	const unclampedIndex = Math.floor(Math.log(bytes) / Math.log(1024))
	const index = Math.min(Math.max(unclampedIndex, 0), maxIndex)

	const value = bytes / 1024 ** index
	const formattedValue = Number.isInteger(value)
		? value.toString()
		: value.toFixed(2)

	return `${formattedValue} ${units[index]}`
}
const targetBytes = Number(process.argv[2])

if (!Number.isFinite(targetBytes) || targetBytes <= 0) {
	throw new Error('Usage: node generate-ts-file.ts <bytes>')
}

// formatBytes(1048576) -> "1 MB" (example)
// normalize to filename: "1mb.ts"
const fileName =
	formatBytes(targetBytes)
		.toLowerCase()
		.replace(/\s+/g, '')
		.replace(/[^a-z0-9]/g, '') + '.ts'

const outPath = resolve(process.cwd(), fileName)
const ws = createWriteStream(outPath, 'utf8')

let written = 0

const header = `/* GENERATED – target ~${targetBytes} bytes */\n\n`
ws.write(header)
written += Buffer.byteLength(header)

function chunk(id: number): string {
	const big = 'abcdef0123456789'.repeat(4096) // ~64KB
	return `
export namespace Chunk${id} {
  export const id = ${id};

  export function work(x: number): number {
    let v = x ^ ${id};
    for (let i = 0; i < 100; i++) v += i;
    return v;
  }

  export const payload = "${big}";
}
`
}

let id = 0

while (written < targetBytes) {
	const c = chunk(id++)
	const size = Buffer.byteLength(c)

	if (written + size > targetBytes) break

	ws.write(c)
	written += size
}

// pad to get close
const remaining = Math.max(0, targetBytes - written)
if (remaining > 0) {
	const pad = '\n/* ' + '0'.repeat(Math.max(0, remaining - 6)) + ' */\n'
	ws.write(pad)
	written += Buffer.byteLength(pad)
}

ws.end()

console.log(`Wrote ~${written} bytes → ${fileName}`)
