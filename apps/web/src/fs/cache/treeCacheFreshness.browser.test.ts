import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import type { FsDirTreeNode } from '@repo/fs'
import { TreeCacheController } from './treeCacheController'

describe('TreeCacheFreshness', () => {
	let cacheController: TreeCacheController
	const testDbName = `test-freshness-${Date.now()}-${Math.random().toString(36).substring(7)}`

	beforeEach(() => {
		cacheController = new TreeCacheController({
			dbName: testDbName,
			storeName: 'test-freshness',
		})
	})

	afterEach(async () => {
		// Clean up test data
		try {
			await cacheController.clearCache()
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Property 8: Modification time validation', () => {
		it('should compare stored timestamps with current modification times and mark entries stale when timestamps are newer', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						path: fc
							.string({ minLength: 1, maxLength: 20 })
							.map((s) => `/${s.replace(/[\0\/]/g, '_')}`),
						name: fc
							.string({ minLength: 1, maxLength: 15 })
							.map((s) => s.replace(/[\0\/]/g, '_')),
						cachedMtime: fc.integer({
							min: 1000000000000,
							max: Date.now() - 10000,
						}), // Older timestamp
						currentMtime: fc.integer({
							min: Date.now() - 5000,
							max: Date.now(),
						}), // Newer timestamp
						childCount: fc.integer({ min: 0, max: 5 }),
					}),
					async (testData) => {
						const { path, name, cachedMtime, currentMtime, childCount } =
							testData

						// Create a directory node
						const directoryNode: FsDirTreeNode = {
							kind: 'dir',
							name,
							path,
							depth: 0,
							children: Array.from({ length: childCount }, (_, i) => ({
								kind: 'file' as const,
								name: `file-${i}.txt`,
								path: `${path}/file-${i}.txt`,
								depth: 1,
								parentPath: path,
								size: 100 + i,
								lastModified: cachedMtime - 1000,
							})),
							isLoaded: true,
						}

						// Cache the directory with the older modification time
						await cacheController.setCachedDirectory(
							path,
							directoryNode,
							cachedMtime
						)

						// Verify the directory was cached
						const cachedData = await cacheController.getCachedDirectory(path)
						expect(cachedData).not.toBeNull()
						expect(cachedData!.path).toBe(path)

						// Test freshness validation with newer current modification time
						const isFresh = await cacheController.isDirectoryFresh(
							path,
							currentMtime
						)

						// Since currentMtime > cachedMtime, the directory should be stale
						if (currentMtime > cachedMtime) {
							expect(isFresh).toBe(false)
						} else {
							// If somehow currentMtime <= cachedMtime, it should be fresh
							expect(isFresh).toBe(true)
						}

						// Test the opposite case - directory should be fresh if cached time is newer
						const newerCachedMtime = currentMtime + 10000
						await cacheController.setCachedDirectory(
							path,
							directoryNode,
							newerCachedMtime
						)

						const isFreshWithNewerCache =
							await cacheController.isDirectoryFresh(path, currentMtime)
						expect(isFreshWithNewerCache).toBe(true)
					}
				),
				{ numRuns: 10 }
			)
		})

		it('should handle edge cases in modification time comparison', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						path: fc
							.string({ minLength: 1, maxLength: 15 })
							.map((s) => `/${s.replace(/[\0\/]/g, '_')}`),
						name: fc
							.string({ minLength: 1, maxLength: 10 })
							.map((s) => s.replace(/[\0\/]/g, '_')),
						mtime: fc.integer({ min: 1000000000000, max: Date.now() }),
					}),
					async (testData) => {
						const { path, name, mtime } = testData

						const directoryNode: FsDirTreeNode = {
							kind: 'dir',
							name,
							path,
							depth: 0,
							children: [],
							isLoaded: true,
						}

						// Test case 1: No cached entry should return false
						const freshWithNoCache = await cacheController.isDirectoryFresh(
							path,
							mtime
						)
						expect(freshWithNoCache).toBe(false)

						// Test case 2: Cache entry with no modification time and no current time should be fresh
						await cacheController.setCachedDirectory(path, directoryNode) // No mtime provided
						const freshWithNoMtimes =
							await cacheController.isDirectoryFresh(path)
						expect(freshWithNoMtimes).toBe(true)

						// Test case 3: Cache entry with modification time but no current time should be fresh
						await cacheController.setCachedDirectory(path, directoryNode, mtime)
						const freshWithCachedMtimeOnly =
							await cacheController.isDirectoryFresh(path)
						expect(freshWithCachedMtimeOnly).toBe(true)

						// Test case 4: Exact timestamp match should be fresh
						const exactFresh = await cacheController.isDirectoryFresh(
							path,
							mtime
						)
						expect(exactFresh).toBe(true)
					}
				),
				{ numRuns: 8 }
			)
		})

		it('should validate and cleanup stale entries in batch operations', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						directories: fc.array(
							fc.record({
								path: fc
									.string({ minLength: 1, maxLength: 15 })
									.map((s) => `/${s.replace(/[\0\/]/g, '_')}`),
								name: fc
									.string({ minLength: 1, maxLength: 10 })
									.map((s) => s.replace(/[\0\/]/g, '_')),
								cachedMtime: fc.integer({
									min: 1000000000000,
									max: Date.now() - 10000,
								}),
								currentMtime: fc.integer({
									min: Date.now() - 5000,
									max: Date.now(),
								}),
							}),
							{ minLength: 2, maxLength: 5 }
						),
					}),
					async (testData) => {
						const { directories } = testData

						// Cache all directories with their cached modification times
						for (const dir of directories) {
							const directoryNode: FsDirTreeNode = {
								kind: 'dir',
								name: dir.name,
								path: dir.path,
								depth: 0,
								children: [],
								isLoaded: true,
							}
							await cacheController.setCachedDirectory(
								dir.path,
								directoryNode,
								dir.cachedMtime
							)
						}

						// Verify all directories were cached
						for (const dir of directories) {
							const cached = await cacheController.getCachedDirectory(dir.path)
							expect(cached).not.toBeNull()
						}

						// Create a map of current modification times
						const currentMtimes = new Map<string, number>()
						directories.forEach((dir) => {
							currentMtimes.set(dir.path, dir.currentMtime)
						})

						// Run batch validation and cleanup
						await cacheController.validateAndCleanupStaleEntries(currentMtimes)

						// Check which directories should be stale and verify they were cleaned up
						for (const dir of directories) {
							const shouldBeStale = dir.currentMtime > dir.cachedMtime
							const cached = await cacheController.getCachedDirectory(dir.path)

							if (shouldBeStale) {
								// Stale entries should have been removed
								expect(cached).toBeNull()
							} else {
								// Fresh entries should still be cached
								expect(cached).not.toBeNull()
							}
						}
					}
				),
				{ numRuns: 6 }
			)
		})
	})

	describe('Property 10: Hierarchical cache invalidation', () => {
		it('should invalidate cache entries for directory and all its ancestor directories', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						// Generate a nested directory structure
						rootPath: fc.constant('/'),
						level1: fc
							.string({ minLength: 1, maxLength: 10 })
							.map((s) => s.replace(/[\0\/]/g, '_')),
						level2: fc
							.string({ minLength: 1, maxLength: 10 })
							.map((s) => s.replace(/[\0\/]/g, '_')),
						level3: fc
							.string({ minLength: 1, maxLength: 10 })
							.map((s) => s.replace(/[\0\/]/g, '_')),
						childCount: fc.integer({ min: 1, max: 3 }),
					}),
					async (testData) => {
						const { rootPath, level1, level2, level3, childCount } = testData

						// Build nested paths
						const level1Path = `/${level1}`
						const level2Path = `/${level1}/${level2}`
						const level3Path = `/${level1}/${level2}/${level3}`

						const allPaths = [rootPath, level1Path, level2Path, level3Path]

						// Create and cache directory nodes for all levels
						for (const path of allPaths) {
							const depth = path === '/' ? 0 : path.split('/').length - 1
							const name =
								path === '/' ? 'root' : path.split('/').pop() || 'unknown'

							const directoryNode: FsDirTreeNode = {
								kind: 'dir',
								name,
								path,
								depth,
								parentPath:
									depth > 0
										? path.substring(0, path.lastIndexOf('/')) || '/'
										: undefined,
								children: Array.from({ length: childCount }, (_, i) => ({
									kind: 'file' as const,
									name: `file-${i}.txt`,
									path: `${path}/file-${i}.txt`,
									depth: depth + 1,
									parentPath: path,
									size: 100 + i,
									lastModified: Date.now() - 1000,
								})),
								isLoaded: true,
							}

							await cacheController.setCachedDirectory(
								path,
								directoryNode,
								Date.now()
							)
						}

						// Verify all directories are cached
						for (const path of allPaths) {
							const cached = await cacheController.getCachedDirectory(path)
							expect(cached).not.toBeNull()
							expect(cached!.path).toBe(path)
						}

						// Mark the deepest directory as stale (this should invalidate ancestors)
						await cacheController.markDirectoryStale(level3Path)

						// Check that the target directory was invalidated
						const targetCached =
							await cacheController.getCachedDirectory(level3Path)
						expect(targetCached).toBeNull()

						// Check that ancestor directories were also invalidated
						const level2Cached =
							await cacheController.getCachedDirectory(level2Path)
						const level1Cached =
							await cacheController.getCachedDirectory(level1Path)
						const rootCached =
							await cacheController.getCachedDirectory(rootPath)

						expect(level2Cached).toBeNull() // Parent should be invalidated
						expect(level1Cached).toBeNull() // Grandparent should be invalidated
						expect(rootCached).toBeNull() // Root should be invalidated
					}
				),
				{ numRuns: 8 }
			)
		})

		it('should correctly identify and invalidate all ancestor paths', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						// Generate various path structures to test ancestor calculation
						pathSegments: fc.array(
							fc
								.string({ minLength: 1, maxLength: 8 })
								.map((s) => s.replace(/[\0\/]/g, '_')),
							{ minLength: 1, maxLength: 4 }
						),
					}),
					async (testData) => {
						const { pathSegments } = testData

						// Build the full path
						const fullPath = '/' + pathSegments.join('/')

						// Calculate expected ancestors manually
						const expectedAncestors: string[] = []
						let currentPath = fullPath

						while (currentPath !== '/' && currentPath !== '') {
							const parentPath = currentPath.substring(
								0,
								currentPath.lastIndexOf('/')
							)
							const normalizedParent = parentPath === '' ? '/' : parentPath

							if (normalizedParent !== currentPath) {
								expectedAncestors.push(normalizedParent)
								currentPath = normalizedParent
							} else {
								break
							}
						}

						// Cache the target directory and all its ancestors
						const allPaths = [fullPath, ...expectedAncestors]

						for (const path of allPaths) {
							const depth = path === '/' ? 0 : path.split('/').length - 1
							const name =
								path === '/' ? 'root' : path.split('/').pop() || 'unknown'

							const directoryNode: FsDirTreeNode = {
								kind: 'dir',
								name,
								path,
								depth,
								parentPath:
									depth > 0
										? path.substring(0, path.lastIndexOf('/')) || '/'
										: undefined,
								children: [],
								isLoaded: true,
							}

							await cacheController.setCachedDirectory(
								path,
								directoryNode,
								Date.now()
							)
						}

						// Verify all paths are cached
						for (const path of allPaths) {
							const cached = await cacheController.getCachedDirectory(path)
							expect(cached).not.toBeNull()
						}

						// Invalidate ancestors of the full path
						await cacheController.invalidateAncestors(fullPath)

						// The target path should still be cached (we only invalidated ancestors)
						const targetCached =
							await cacheController.getCachedDirectory(fullPath)
						expect(targetCached).not.toBeNull()

						// All ancestor paths should be invalidated
						for (const ancestorPath of expectedAncestors) {
							const ancestorCached =
								await cacheController.getCachedDirectory(ancestorPath)
							expect(ancestorCached).toBeNull()
						}
					}
				),
				{ numRuns: 10 }
			)
		})

		it('should handle edge cases in hierarchical invalidation', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						rootName: fc
							.string({ minLength: 1, maxLength: 8 })
							.map((s) => s.replace(/[\0\/]/g, '_')),
					}),
					async (testData) => {
						const { rootName } = testData

						// Test edge cases
						const testCases = [
							'/', // Root directory
							`/${rootName}`, // Single level
							`/${rootName}/sub`, // Two levels
						]

						// Cache all test directories
						for (const path of testCases) {
							const depth = path === '/' ? 0 : path.split('/').length - 1
							const name =
								path === '/' ? 'root' : path.split('/').pop() || 'unknown'

							const directoryNode: FsDirTreeNode = {
								kind: 'dir',
								name,
								path,
								depth,
								parentPath:
									depth > 0
										? path.substring(0, path.lastIndexOf('/')) || '/'
										: undefined,
								children: [],
								isLoaded: true,
							}

							await cacheController.setCachedDirectory(
								path,
								directoryNode,
								Date.now()
							)
						}

						// Test invalidating root directory ancestors (should be safe no-op)
						await cacheController.invalidateAncestors('/')

						// Root should still be cached (no ancestors to invalidate)
						const rootCached = await cacheController.getCachedDirectory('/')
						expect(rootCached).not.toBeNull()

						// Test invalidating single-level directory
						await cacheController.markDirectoryStale(`/${rootName}`)

						// Single-level directory should be invalidated
						const singleLevelCached = await cacheController.getCachedDirectory(
							`/${rootName}`
						)
						expect(singleLevelCached).toBeNull()

						// Root should also be invalidated (ancestor)
						const rootAfterInvalidation =
							await cacheController.getCachedDirectory('/')
						expect(rootAfterInvalidation).toBeNull()
					}
				),
				{ numRuns: 6 }
			)
		})
	})
})
