/**
 * File Loading Error Types and State Management
 *
 * Provides structured error types for file operations and loading state tracking.
 * Supports retry mechanisms and user-friendly error messages.
 *
 * Requirements: 5.3, 5.4, 5.5
 */

import { createSignal, type Accessor } from 'solid-js'

// ============================================================================
// Error Types
// ============================================================================

/** Base error type for file loading */
export type FileLoadingErrorType =
	| 'not-found'
	| 'permission-denied'
	| 'network-error'
	| 'invalid-encoding'
	| 'binary-file'
	| 'file-too-large'
	| 'corrupted'
	| 'unknown'

/** Detailed error information for file loading */
export interface FileLoadingError {
	type: FileLoadingErrorType
	message: string
	filePath: string
	timestamp: number
	retryable: boolean
	details?: string
}

/** Loading state for a file */
export type FileLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

/** Complete file loading state */
export interface FileLoadingState {
	status: Accessor<FileLoadingStatus>
	error: Accessor<FileLoadingError | null>
	progress: Accessor<number> // 0-100 for large files
	fileSize: Accessor<number | null>
	isBinary: Accessor<boolean>
	retryCount: Accessor<number>
	setStatus: (status: FileLoadingStatus) => void
	setError: (error: FileLoadingError | null) => void
	setProgress: (progress: number) => void
	setFileSize: (size: number | null) => void
	setIsBinary: (isBinary: boolean) => void
	incrementRetryCount: () => void
	resetRetryCount: () => void
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Large file threshold for progress indication (1 MB) */
export const LARGE_FILE_THRESHOLD = 1 * 1024 * 1024

/** Maximum retry attempts */
export const MAX_RETRY_ATTEMPTS = 3

/** Retry delay in ms (with exponential backoff) */
export const RETRY_BASE_DELAY = 1000

// ============================================================================
// Error Factory Functions
// ============================================================================

export function createNotFoundError(filePath: string): FileLoadingError {
	return {
		type: 'not-found',
		message: 'File not found',
		filePath,
		timestamp: Date.now(),
		retryable: false,
		details: 'The file may have been moved, renamed, or deleted.',
	}
}

export function createPermissionError(filePath: string): FileLoadingError {
	return {
		type: 'permission-denied',
		message: 'Permission denied',
		filePath,
		timestamp: Date.now(),
		retryable: true,
		details: 'You do not have permission to read this file. Try granting access.',
	}
}

export function createNetworkError(filePath: string, details?: string): FileLoadingError {
	return {
		type: 'network-error',
		message: 'Network error',
		filePath,
		timestamp: Date.now(),
		retryable: true,
		details: details || 'Failed to load file due to a network error. Please try again.',
	}
}

export function createEncodingError(filePath: string): FileLoadingError {
	return {
		type: 'invalid-encoding',
		message: 'Invalid file encoding',
		filePath,
		timestamp: Date.now(),
		retryable: false,
		details: 'This file contains characters that cannot be decoded as text.',
	}
}

export function createBinaryFileError(filePath: string): FileLoadingError {
	return {
		type: 'binary-file',
		message: 'Binary file',
		filePath,
		timestamp: Date.now(),
		retryable: false,
		details: 'This appears to be a binary file and cannot be edited as text.',
	}
}

export function createFileTooLargeError(filePath: string, fileSize: number): FileLoadingError {
	const sizeMB = (fileSize / (1024 * 1024)).toFixed(1)
	const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
	return {
		type: 'file-too-large',
		message: 'File too large',
		filePath,
		timestamp: Date.now(),
		retryable: false,
		details: `This file is ${sizeMB} MB. Maximum supported size is ${maxSizeMB} MB.`,
	}
}

export function createCorruptedError(filePath: string): FileLoadingError {
	return {
		type: 'corrupted',
		message: 'File corrupted',
		filePath,
		timestamp: Date.now(),
		retryable: true,
		details: 'The file appears to be corrupted or in an unexpected format.',
	}
}

export function createUnknownError(filePath: string, originalError?: unknown): FileLoadingError {
	const errorMessage = originalError instanceof Error ? originalError.message : String(originalError)
	return {
		type: 'unknown',
		message: 'Failed to load file',
		filePath,
		timestamp: Date.now(),
		retryable: true,
		details: errorMessage || 'An unexpected error occurred while loading the file.',
	}
}

// ============================================================================
// State Factory
// ============================================================================

/** Create a file loading state with reactive signals */
export function createFileLoadingState(): FileLoadingState {
	const [status, setStatus] = createSignal<FileLoadingStatus>('idle')
	const [error, setError] = createSignal<FileLoadingError | null>(null)
	const [progress, setProgress] = createSignal(0)
	const [fileSize, setFileSize] = createSignal<number | null>(null)
	const [isBinary, setIsBinary] = createSignal(false)
	const [retryCount, setRetryCount] = createSignal(0)

	return {
		status,
		error,
		progress,
		fileSize,
		isBinary,
		retryCount,
		setStatus,
		setError,
		setProgress,
		setFileSize,
		setIsBinary,
		incrementRetryCount: () => setRetryCount((c) => c + 1),
		resetRetryCount: () => setRetryCount(0),
	}
}

// ============================================================================
// File Type Detection
// ============================================================================

/** Common binary file extensions */
const BINARY_EXTENSIONS = new Set([
	// Images
	'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.tiff', '.psd',
	// Audio
	'.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
	// Video
	'.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
	// Archives
	'.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz',
	// Executables & Libraries
	'.exe', '.dll', '.so', '.dylib', '.bin', '.app',
	// Documents (binary)
	'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
	// Fonts
	'.ttf', '.otf', '.woff', '.woff2', '.eot',
	// Database
	'.db', '.sqlite', '.sqlite3',
	// Other binary
	'.class', '.pyc', '.o', '.a', '.node', '.wasm',
])

/** Check if a file extension indicates a binary file */
export function isBinaryExtension(filePath: string): boolean {
	const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
	return BINARY_EXTENSIONS.has(ext)
}

/** Check if content appears to be binary (contains null bytes or high percentage of non-printable chars) */
export function isBinaryContent(buffer: ArrayBuffer, sampleSize = 8192): boolean {
	const bytes = new Uint8Array(buffer.slice(0, sampleSize))
	let nonPrintable = 0

	for (let i = 0; i < bytes.length; i++) {
		const byte = bytes[i]!
		// Null bytes are a strong indicator of binary content
		if (byte === 0) {
			return true
		}
		// Count non-printable characters (excluding common whitespace)
		if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
			nonPrintable++
		}
	}

	// If more than 10% non-printable, likely binary
	return nonPrintable / bytes.length > 0.1
}

// ============================================================================
// Error Classification
// ============================================================================

/** Classify an unknown error into a FileLoadingError */
export function classifyError(filePath: string, error: unknown): FileLoadingError {
	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		const name = error.name.toLowerCase()

		// Check for specific error types
		if (name === 'notfounderror' || message.includes('not found') || message.includes('no such file')) {
			return createNotFoundError(filePath)
		}

		if (name === 'notallowederror' || message.includes('permission') || message.includes('access denied')) {
			return createPermissionError(filePath)
		}

		if (name === 'networkerror' || message.includes('network') || message.includes('fetch')) {
			return createNetworkError(filePath, error.message)
		}

		if (message.includes('encoding') || message.includes('decode') || message.includes('utf')) {
			return createEncodingError(filePath)
		}

		if (name === 'aborterror' || message.includes('abort')) {
			// Aborted requests are not really errors - return null or handle differently
			return createUnknownError(filePath, error)
		}
	}

	return createUnknownError(filePath, error)
}

// ============================================================================
// Retry Logic
// ============================================================================

/** Calculate retry delay with exponential backoff */
export function calculateRetryDelay(attemptNumber: number): number {
	return RETRY_BASE_DELAY * Math.pow(2, attemptNumber - 1)
}

/** Check if an error should trigger a retry */
export function shouldRetry(error: FileLoadingError, currentAttempt: number): boolean {
	return error.retryable && currentAttempt < MAX_RETRY_ATTEMPTS
}

// ============================================================================
// User-Friendly Messages
// ============================================================================

/** Get a user-friendly title for an error type */
export function getErrorTitle(errorType: FileLoadingErrorType): string {
	switch (errorType) {
		case 'not-found':
			return 'File Not Found'
		case 'permission-denied':
			return 'Access Denied'
		case 'network-error':
			return 'Network Error'
		case 'invalid-encoding':
			return 'Encoding Error'
		case 'binary-file':
			return 'Binary File'
		case 'file-too-large':
			return 'File Too Large'
		case 'corrupted':
			return 'File Corrupted'
		case 'unknown':
		default:
			return 'Error'
	}
}

/** Get an icon name for an error type */
export function getErrorIcon(errorType: FileLoadingErrorType): string {
	switch (errorType) {
		case 'not-found':
			return 'file-x'
		case 'permission-denied':
			return 'lock'
		case 'network-error':
			return 'wifi-off'
		case 'invalid-encoding':
			return 'file-warning'
		case 'binary-file':
			return 'file-binary'
		case 'file-too-large':
			return 'file-warning'
		case 'corrupted':
			return 'file-x'
		case 'unknown':
		default:
			return 'alert-circle'
	}
}
