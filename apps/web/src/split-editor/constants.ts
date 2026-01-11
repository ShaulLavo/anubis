/**
 * Split Editor Constants
 *
 * Configuration constants for the split editor system.
 */

/** Minimum size for a pane as a fraction (0.1 = 10% of container) */
export const MIN_PANE_SIZE = 0.1

/** Default split sizes when creating new splits */
export const DEFAULT_SPLIT_SIZES: [number, number] = [0.5, 0.5]

/** Focus indicator transition duration in milliseconds */
export const FOCUS_TRANSITION_DURATION = 200

/** CSS containment mode for performance optimization */
export const CONTAINMENT_MODE = 'strict' as const