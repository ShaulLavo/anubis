/**
 * Property-based tests for File Loading Error Handling
 * **Feature: split-editor-fixes, Properties 10, 11, 12**
 * **Validates: Requirements 5.3, 5.4, 5.5**
 *
 * Tests error classification, file type detection, and large file handling.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
	classifyError,
	isBinaryExtension,
	isBinaryContent,
	createFileLoadingState,
	createNotFoundError,
	createPermissionError,
	createNetworkError,
	createEncodingError,
	createBinaryFileError,
	createFileTooLargeError,
	createCorruptedError,
	createUnknownError,
	shouldRetry,
	calculateRetryDelay,
	getErrorTitle,
	MAX_FILE_SIZE,
	MAX_RETRY_ATTEMPTS,
	RETRY_BASE_DELAY,
} from './fileLoadingErrors'

describe('File Loading Error Handling Properties', () => {
	/**
	 * Property 10: Error Handling
	 * For any file that fails to load, the system should display an appropriate
	 * error message in the tab without breaking the editor functionality.
	 * **Validates: Requirements 5.3**
	 */
	describe('Property 10: Error Handling', () => {
		it('property: all error factory functions create valid error objects', () => {
			fc.assert(
				fc.property(
					fc.record({
						filePath: fc.string({ minLength: 1, maxLength: 100 }),
						fileSize: fc.integer({ min: 1, max: 100 * 1024 * 1024 }),
					}),
					(config) => {
						// Test all error factory functions
						const errors = [
							createNotFoundError(config.filePath),
							createPermissionError(config.filePath),
							createNetworkError(config.filePath),
							createEncodingError(config.filePath),
							createBinaryFileError(config.filePath),
							createFileTooLargeError(config.filePath, config.fileSize),
							createCorruptedError(config.filePath),
							createUnknownError(config.filePath),
						]

						for (const error of errors) {
							// Every error should have required properties
							expect(error.type).toBeDefined()
							expect(error.message).toBeDefined()
							expect(error.filePath).toBe(config.filePath)
							expect(error.timestamp).toBeGreaterThan(0)
							expect(typeof error.retryable).toBe('boolean')

							// Should have a valid title
							const title = getErrorTitle(error.type)
							expect(title).toBeDefined()
							expect(title.length).toBeGreaterThan(0)
						}
					}
				),
				{ numRuns: 50 }
			)
		})

		it('property: error classification handles various error types correctly', () => {
			// Test specific error scenarios with matching type and message
			const errorScenarios = [
				{ type: 'NotFoundError', message: 'File not found', expectedClassification: 'not-found' },
				{ type: 'NotAllowedError', message: 'Permission denied', expectedClassification: 'permission-denied' },
				{ type: 'NetworkError', message: 'Network error occurred', expectedClassification: 'network-error' },
				{ type: 'TypeError', message: 'Invalid encoding', expectedClassification: 'invalid-encoding' },
				{ type: 'Error', message: 'Unknown error', expectedClassification: 'unknown' },
			]

			fc.assert(
				fc.property(
					fc.record({
						filePath: fc.string({ minLength: 1, maxLength: 50 }),
						scenarioIndex: fc.integer({ min: 0, max: errorScenarios.length - 1 }),
					}),
					(config) => {
						const scenario = errorScenarios[config.scenarioIndex]!
						const testError = new Error(scenario.message)
						// @ts-ignore - setting name for test purposes
						testError.name = scenario.type

						const classified = classifyError(config.filePath, testError)

						// Classification should always produce a valid error
						expect(classified.type).toBeDefined()
						expect(classified.filePath).toBe(config.filePath)
						expect(classified.timestamp).toBeGreaterThan(0)
						expect(classified.type).toBe(scenario.expectedClassification)
					}
				),
				{ numRuns: 50 }
			)
		})

		it('property: retry logic respects max attempts', () => {
			fc.assert(
				fc.property(
					fc.record({
						attemptNumber: fc.integer({ min: 0, max: 10 }),
						isRetryable: fc.boolean(),
					}),
					(config) => {
						const error = config.isRetryable
							? createNetworkError('/test/file.ts')
							: createNotFoundError('/test/file.ts')

						const canRetry = shouldRetry(error, config.attemptNumber)

						// Should only retry if error is retryable AND under max attempts
						if (!config.isRetryable) {
							expect(canRetry).toBe(false)
						} else if (config.attemptNumber >= MAX_RETRY_ATTEMPTS) {
							expect(canRetry).toBe(false)
						} else {
							expect(canRetry).toBe(true)
						}
					}
				),
				{ numRuns: 50 }
			)
		})

		it('property: retry delay increases exponentially', () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 10 }),
					(attemptNumber) => {
						const delay = calculateRetryDelay(attemptNumber)
						const expectedDelay = RETRY_BASE_DELAY * Math.pow(2, attemptNumber - 1)

						expect(delay).toBe(expectedDelay)

						// Delay should increase with attempt number
						if (attemptNumber > 1) {
							const previousDelay = calculateRetryDelay(attemptNumber - 1)
							expect(delay).toBeGreaterThan(previousDelay)
						}
					}
				),
				{ numRuns: 10 }
			)
		})

		it('property: loading state signals work correctly', () => {
			fc.assert(
				fc.property(
					fc.record({
						status: fc.constantFrom('idle', 'loading', 'loaded', 'error') as fc.Arbitrary<'idle' | 'loading' | 'loaded' | 'error'>,
						hasError: fc.boolean(),
						progress: fc.integer({ min: 0, max: 100 }),
						fileSize: fc.integer({ min: 0, max: 100 * 1024 * 1024 }),
						isBinary: fc.boolean(),
					}),
					(config) => {
						const state = createFileLoadingState()

						// Set values
						state.setStatus(config.status)
						state.setProgress(config.progress)
						state.setFileSize(config.fileSize)
						state.setIsBinary(config.isBinary)

						// Verify values are set correctly
						expect(state.status()).toBe(config.status)
						expect(state.progress()).toBe(config.progress)
						expect(state.fileSize()).toBe(config.fileSize)
						expect(state.isBinary()).toBe(config.isBinary)

						// Test retry count
						state.incrementRetryCount()
						expect(state.retryCount()).toBe(1)
						state.incrementRetryCount()
						expect(state.retryCount()).toBe(2)
						state.resetRetryCount()
						expect(state.retryCount()).toBe(0)
					}
				),
				{ numRuns: 30 }
			)
		})
	})

	/**
	 * Property 11: File Type Handling
	 * For any file type (text or binary), the system should handle it
	 * appropriately with proper content display or appropriate fallback behavior.
	 * **Validates: Requirements 5.4**
	 */
	describe('Property 11: File Type Handling', () => {
		it('property: binary extensions are detected correctly', () => {
			const binaryExtensions = [
				'.png', '.jpg', '.gif', '.exe', '.dll', '.zip', '.pdf',
				'.mp3', '.mp4', '.wasm', '.db', '.sqlite', '.ttf', '.woff',
			]

			const textExtensions = [
				'.txt', '.ts', '.js', '.tsx', '.jsx', '.json', '.md',
				'.html', '.css', '.scss', '.xml', '.yaml', '.yml',
			]

			fc.assert(
				fc.property(
					fc.record({
						baseName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('.')),
						extension: fc.constantFrom(...binaryExtensions, ...textExtensions),
					}),
					(config) => {
						const filePath = `/test/${config.baseName}${config.extension}`
						const isBinary = isBinaryExtension(filePath)

						if (binaryExtensions.includes(config.extension)) {
							expect(isBinary).toBe(true)
						} else {
							expect(isBinary).toBe(false)
						}
					}
				),
				{ numRuns: 50 }
			)
		})

		it('property: binary content is detected by null bytes', () => {
			fc.assert(
				fc.property(
					fc.record({
						hasNullBytes: fc.boolean(),
						contentLength: fc.integer({ min: 10, max: 1000 }),
					}),
					(config) => {
						// Create test buffer
						const buffer = new ArrayBuffer(config.contentLength)
						const view = new Uint8Array(buffer)

						// Fill with printable ASCII
						for (let i = 0; i < config.contentLength; i++) {
							view[i] = 65 + (i % 26) // A-Z
						}

						// Add null bytes if specified
						if (config.hasNullBytes) {
							view[Math.floor(config.contentLength / 2)] = 0
						}

						const isBinary = isBinaryContent(buffer)

						// Content with null bytes should be detected as binary
						if (config.hasNullBytes) {
							expect(isBinary).toBe(true)
						} else {
							expect(isBinary).toBe(false)
						}
					}
				),
				{ numRuns: 30 }
			)
		})

		it('property: binary content detection handles high non-printable ratio', () => {
			fc.assert(
				fc.property(
					fc.record({
						nonPrintableRatio: fc.float({ min: 0, max: 1, noNaN: true }),
						contentLength: fc.integer({ min: 100, max: 500 }),
					}),
					(config) => {
						const buffer = new ArrayBuffer(config.contentLength)
						const view = new Uint8Array(buffer)

						// Fill based on ratio (avoid null bytes for this test)
						const nonPrintableCount = Math.floor(config.contentLength * config.nonPrintableRatio)
						for (let i = 0; i < config.contentLength; i++) {
							if (i < nonPrintableCount) {
								// Non-printable but not null (1-8, 11-12, 14-31)
								view[i] = 1 + (i % 8)
							} else {
								// Printable ASCII
								view[i] = 65 + (i % 26)
							}
						}

						const isBinary = isBinaryContent(buffer)

						// More than 10% non-printable should be detected as binary
						if (config.nonPrintableRatio > 0.1) {
							expect(isBinary).toBe(true)
						} else {
							expect(isBinary).toBe(false)
						}
					}
				),
				{ numRuns: 30 }
			)
		})
	})

	/**
	 * Property 12: Large File Loading
	 * For any large file being opened, the system should provide loading
	 * feedback and handle the content without blocking the UI.
	 * **Validates: Requirements 5.5**
	 */
	describe('Property 12: Large File Loading', () => {
		it('property: file size limits are enforced consistently', () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 0, max: 20 * 1024 * 1024 }), // 0 to 20 MB
					(fileSize) => {
						const isOverLimit = fileSize > MAX_FILE_SIZE

						// Files over the limit should create a file-too-large error
						if (isOverLimit) {
							const error = createFileTooLargeError('/test/large.bin', fileSize)
							expect(error.type).toBe('file-too-large')
							expect(error.details).toContain('MB')
						}
					}
				),
				{ numRuns: 50 }
			)
		})

		it('property: loading progress is valid percentage', () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 0, max: 100 }),
					(progress) => {
						const state = createFileLoadingState()
						state.setProgress(progress)

						const currentProgress = state.progress()
						expect(currentProgress).toBeGreaterThanOrEqual(0)
						expect(currentProgress).toBeLessThanOrEqual(100)
						expect(currentProgress).toBe(progress)
					}
				),
				{ numRuns: 20 }
			)
		})

		it('property: file size is tracked correctly', () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 0, max: 100 * 1024 * 1024 }),
					(fileSize) => {
						const state = createFileLoadingState()

						// Initially null
						expect(state.fileSize()).toBeNull()

						// After setting
						state.setFileSize(fileSize)
						expect(state.fileSize()).toBe(fileSize)

						// Can be reset to null
						state.setFileSize(null)
						expect(state.fileSize()).toBeNull()
					}
				),
				{ numRuns: 20 }
			)
		})
	})
})
