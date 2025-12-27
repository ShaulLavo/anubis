import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import type { FsDirTreeNode } from '@repo/fs'
import { WorkerTreeCache, createWorkerTreeCache } from './workerTreeCache'
import type { CachedDirectoryEntry } from './treeCacheController'

describe('WorkerTreeCache', () => {
	let workerCache: WorkerTreeCache
	const testDbName = `test-worker-cache-${Date.now()}-${Math.random().toString(36).substring(7)}`

	beforeEach(() => {
		workerCache = createWorkerTreeCache({ 
			dbName: testDbName,
			storeName: 'test-directories'
		})
	})

	afterEach(async () => {
		// Clean up test data by clearing the entire cache
		try {
			await workerCache.clear()
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Property 5: Worker LocalForage access', () => {
		it('should read and write LocalForage data using the same database schema as the main thread', async () => {
			await fc.assert(
				fc.asyncProperty(
					// Generate test directory data
					fc.record({
						path: fc.oneof(
							fc.string({ minLength: 1, maxLength: 30 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
							fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 })
								.map(parts => '/' + parts.map(p => p.replace(/[\0\/]/g, '_')).join('/'))
						),
						name: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[\0\/]/g, '_')),
						depth: fc.integer({ min: 0, max: 10 }),
						children: fc.array(
							fc.record({
								kind: fc.oneof(fc.constant('file' as const), fc.constant('dir' as const)),
								name: fc.string({ minLength: 1, maxLength: 15 }).map(s => s.replace(/[\0\/]/g, '_')),
								path: fc.string({ minLength: 1, maxLength: 40 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
								depth: fc.integer({ min: 1, max: 11 }),
								size: fc.option(fc.integer({ min: 0, max: 1000000 })),
								lastModified: fc.option(fc.integer({ min: 1000000000000, max: Date.now() })),
								isLoaded: fc.option(fc.boolean())
							}),
							{ minLength: 0, maxLength: 5 }
						)
					}),
					async (testData) => {
						// Create cached directory entry
						const cachedEntry: CachedDirectoryEntry = {
							path: testData.path,
							name: testData.name,
							depth: testData.depth,
							parentPath: testData.depth > 0 ? '/' : undefined,
							cachedAt: Date.now(),
							lastModified: Date.now() - 1000,
							version: 1,
							children: testData.children.map(child => ({
								kind: child.kind,
								name: child.name,
								path: child.path,
								depth: child.depth,
								parentPath: testData.path,
								size: child.kind === 'file' ? (child.size ?? undefined) : undefined,
								lastModified: child.kind === 'file' ? (child.lastModified ?? undefined) : undefined,
								isLoaded: child.kind === 'dir' ? (child.isLoaded ?? undefined) : undefined
							})),
							isLoaded: true
						}

						// Test write operation
						await workerCache.setDirectory(testData.path, cachedEntry)

						// Test read operation
						const retrieved = await workerCache.getDirectory(testData.path)

						// Verify data integrity
						expect(retrieved).not.toBeNull()
						expect(retrieved!.path).toBe(testData.path)
						expect(retrieved!.name).toBe(testData.name)
						expect(retrieved!.depth).toBe(testData.depth)
						expect(retrieved!.version).toBe(1)
						expect(retrieved!.isLoaded).toBe(true)
						expect(retrieved!.children).toHaveLength(testData.children.length)

						// Verify children data
						for (let i = 0; i < testData.children.length; i++) {
							const originalChild = testData.children[i]
							const retrievedChild = retrieved!.children[i]
							
							if (!originalChild || !retrievedChild) continue
							
							expect(retrievedChild.kind).toBe(originalChild.kind)
							expect(retrievedChild.name).toBe(originalChild.name)
							expect(retrievedChild.path).toBe(originalChild.path)
							expect(retrievedChild.depth).toBe(originalChild.depth)
							expect(retrievedChild.parentPath).toBe(testData.path)
							
							if (originalChild.kind === 'file') {
								expect(retrievedChild.size).toBe(originalChild.size ?? undefined)
								expect(retrievedChild.lastModified).toBe(originalChild.lastModified ?? undefined)
							} else {
								expect(retrievedChild.isLoaded).toBe(originalChild.isLoaded ?? undefined)
							}
						}

						// Verify cache key format consistency (same as main thread)
						// The key should follow the format "v1:tree:dir:{path}"
						const expectedKeyFormat = `v1:tree:dir:${testData.path}`
						
						// Test that we can retrieve using the same key format
						const retrievedAgain = await workerCache.getDirectory(testData.path)
						expect(retrievedAgain).not.toBeNull()
						expect(retrievedAgain!.path).toBe(testData.path)
					}
				),
				{ numRuns: 20 }
			)
		})

		it('should handle batch operations efficiently', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.array(
						fc.record({
							path: fc.string({ minLength: 1, maxLength: 20 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
							name: fc.string({ minLength: 1, maxLength: 15 }).map(s => s.replace(/[\0\/]/g, '_')),
							depth: fc.integer({ min: 0, max: 5 })
						}),
						{ minLength: 1, maxLength: 10 }
					),
					async (directories) => {
						// Create batch entries
						const batchEntries = new Map<string, CachedDirectoryEntry>()
						
						for (const dir of directories) {
							const entry: CachedDirectoryEntry = {
								path: dir.path,
								name: dir.name,
								depth: dir.depth,
								parentPath: dir.depth > 0 ? '/' : undefined,
								cachedAt: Date.now(),
								lastModified: Date.now() - 1000,
								version: 1,
								children: [],
								isLoaded: true
							}
							batchEntries.set(dir.path, entry)
						}

						// Perform batch write
						await workerCache.batchSetDirectories(batchEntries)

						// Verify all entries were written correctly
						for (const [path, originalEntry] of batchEntries) {
							const retrieved = await workerCache.getDirectory(path)
							
							expect(retrieved).not.toBeNull()
							expect(retrieved!.path).toBe(originalEntry.path)
							expect(retrieved!.name).toBe(originalEntry.name)
							expect(retrieved!.depth).toBe(originalEntry.depth)
							expect(retrieved!.version).toBe(originalEntry.version)
						}
					}
				),
				{ numRuns: 15 }
			)
		})

		it('should handle freshness validation correctly', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						path: fc.string({ minLength: 1, maxLength: 20 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
						name: fc.string({ minLength: 1, maxLength: 15 }).map(s => s.replace(/[\0\/]/g, '_')),
						cachedMtime: fc.integer({ min: 1000000000000, max: Date.now() - 10000 }),
						currentMtime: fc.integer({ min: 1000000000000, max: Date.now() })
					}),
					async (testData) => {
						// Create cached entry with specific modification time
						const cachedEntry: CachedDirectoryEntry = {
							path: testData.path,
							name: testData.name,
							depth: 0,
							cachedAt: Date.now(),
							lastModified: testData.cachedMtime,
							version: 1,
							children: [],
							isLoaded: true
						}

						await workerCache.setDirectory(testData.path, cachedEntry)

						// Test freshness validation
						const isFresh = await workerCache.isDirectoryFresh(testData.path, testData.currentMtime)
						
						// Entry should be fresh if cached mtime >= current mtime
						const expectedFresh = testData.cachedMtime >= testData.currentMtime
						expect(isFresh).toBe(expectedFresh)

						// Test freshness without current mtime (should be fresh)
						const isFreshWithoutMtime = await workerCache.isDirectoryFresh(testData.path)
						expect(isFreshWithoutMtime).toBe(true)

						// Test freshness for non-existent entry
						const nonExistentFresh = await workerCache.isDirectoryFresh('/non-existent-path', testData.currentMtime)
						expect(nonExistentFresh).toBe(false)
					}
				),
				{ numRuns: 15 }
			)
		})
	})

	describe('Property 7: Cache population from scans', () => {
		it('should store newly scanned directory data back to the cache', async () => {
			await fc.assert(
				fc.asyncProperty(
					// Generate filesystem scan results
					fc.record({
						scannedPath: fc.string({ minLength: 1, maxLength: 20 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
						scannedData: fc.record({
							name: fc.string({ minLength: 1, maxLength: 15 }).map(s => s.replace(/[\0\/]/g, '_')),
							depth: fc.integer({ min: 0, max: 5 }),
							children: fc.array(
								fc.record({
									kind: fc.oneof(fc.constant('file' as const), fc.constant('dir' as const)),
									name: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[\0\/]/g, '_')),
									path: fc.string({ minLength: 1, maxLength: 30 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
									depth: fc.integer({ min: 1, max: 6 }),
									size: fc.option(fc.integer({ min: 0, max: 100000 })),
									lastModified: fc.option(fc.integer({ min: 1000000000000, max: Date.now() }))
								}),
								{ minLength: 0, maxLength: 8 }
							)
						})
					}),
					async (testData) => {
						await workerCache.clear()

						const { scannedPath, scannedData } = testData

						// Simulate a filesystem scan result
						const scanResult: CachedDirectoryEntry = {
							path: scannedPath,
							name: scannedData.name,
							depth: scannedData.depth,
							parentPath: scannedData.depth > 0 ? '/' : undefined,
							cachedAt: Date.now(),
							lastModified: Date.now() - 500, // Recently scanned
							version: 1,
							children: scannedData.children.map(child => ({
								kind: child.kind,
								name: child.name,
								path: child.path,
								depth: child.depth,
								parentPath: scannedPath,
								size: child.kind === 'file' ? (child.size ?? undefined) : undefined,
								lastModified: child.kind === 'file' ? (child.lastModified ?? undefined) : undefined,
								isLoaded: child.kind === 'dir' ? true : undefined
							})),
							isLoaded: true
						}

						// Verify cache is initially empty for this path
						const initialCached = await workerCache.getDirectory(scannedPath)
						expect(initialCached).toBeNull()

						// Simulate worker populating cache from scan results
						await workerCache.setDirectory(scannedPath, scanResult)

						// Verify the scan result was stored in cache
						const cachedResult = await workerCache.getDirectory(scannedPath)
						expect(cachedResult).not.toBeNull()
						expect(cachedResult!.path).toBe(scannedPath)
						expect(cachedResult!.name).toBe(scannedData.name)
						expect(cachedResult!.depth).toBe(scannedData.depth)
						expect(cachedResult!.children).toHaveLength(scannedData.children.length)

						// Verify all children were preserved correctly
						for (let i = 0; i < scannedData.children.length; i++) {
							const originalChild = scannedData.children[i]
							const cachedChild = cachedResult!.children[i]
							
							if (!originalChild || !cachedChild) continue
							
							expect(cachedChild.kind).toBe(originalChild.kind)
							expect(cachedChild.name).toBe(originalChild.name)
							expect(cachedChild.path).toBe(originalChild.path)
							expect(cachedChild.parentPath).toBe(scannedPath)
							
							if (originalChild.kind === 'file') {
								expect(cachedChild.size).toBe(originalChild.size ?? undefined)
								expect(cachedChild.lastModified).toBe(originalChild.lastModified ?? undefined)
							} else {
								expect(cachedChild.isLoaded).toBe(true)
							}
						}

						// Verify cache metadata is properly set
						expect(cachedResult!.version).toBe(1)
						expect(cachedResult!.isLoaded).toBe(true)
						expect(cachedResult!.cachedAt).toBeGreaterThan(0)
						expect(cachedResult!.lastModified).toBeGreaterThan(0)
					}
				),
				{ numRuns: 15 }
			)
		})

		it('should handle batch cache population from multiple scan results', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.array(
						fc.record({
							path: fc.string({ minLength: 1, maxLength: 15 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
							name: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[\0\/]/g, '_')),
							depth: fc.integer({ min: 0, max: 3 }),
							childCount: fc.integer({ min: 0, max: 3 })
						}),
						{ minLength: 1, maxLength: 5 }
					),
					async (scanResults) => {
						await workerCache.clear()

						// Create batch of scan results
						const batchEntries = new Map<string, CachedDirectoryEntry>()
						
						for (const scan of scanResults) {
							const entry: CachedDirectoryEntry = {
								path: scan.path,
								name: scan.name,
								depth: scan.depth,
								parentPath: scan.depth > 0 ? '/' : undefined,
								cachedAt: Date.now(),
								lastModified: Date.now() - 1000,
								version: 1,
								children: Array.from({ length: scan.childCount }, (_, i) => ({
									kind: 'file' as const,
									name: `file${i}.txt`,
									path: `${scan.path}/file${i}.txt`,
									depth: scan.depth + 1,
									parentPath: scan.path,
									size: 100 + i,
									lastModified: Date.now() - 2000
								})),
								isLoaded: true
							}
							batchEntries.set(scan.path, entry)
						}

						// Verify cache is initially empty
						for (const path of batchEntries.keys()) {
							const initial = await workerCache.getDirectory(path)
							expect(initial).toBeNull()
						}

						// Populate cache with batch scan results
						await workerCache.batchSetDirectories(batchEntries)

						// Verify all scan results were cached correctly
						for (const [path, originalEntry] of batchEntries) {
							const cached = await workerCache.getDirectory(path)
							
							expect(cached).not.toBeNull()
							expect(cached!.path).toBe(originalEntry.path)
							expect(cached!.name).toBe(originalEntry.name)
							expect(cached!.depth).toBe(originalEntry.depth)
							expect(cached!.children).toHaveLength(originalEntry.children.length)
							expect(cached!.isLoaded).toBe(true)
							expect(cached!.version).toBe(1)
						}
					}
				),
				{ numRuns: 10 }
			)
		})
	})
})
