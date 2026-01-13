import type { JSX } from 'solid-js'

// ============================================================================
// Types
// ============================================================================

/** Valid placement positions for anchor-positioned elements */
export type Placement =
	| 'top'
	| 'top-start'
	| 'top-end'
	| 'bottom'
	| 'bottom-start'
	| 'bottom-end'
	| 'left'
	| 'left-start'
	| 'left-end'
	| 'right'
	| 'right-start'
	| 'right-end'

/** CSS position-area values mapped from Placement */
export type PositionArea =
	| 'top'
	| 'top start'
	| 'top end'
	| 'bottom'
	| 'bottom start'
	| 'bottom end'
	| 'left'
	| 'left start'
	| 'left end'
	| 'right'
	| 'right start'
	| 'right end'

/** Flip strategy for position fallbacks */
export type FlipStrategy = 'flip-block' | 'flip-inline' | 'flip-block flip-inline'

export interface AnchorOptions {
	/** Custom anchor name (auto-generated if not provided) */
	name?: string
	/** Prefix for auto-generated names */
	prefix?: string
}

export interface AnchorResult {
	/** The CSS anchor name (e.g., "--anchor-1") */
	name: string
	/** Style props to spread on the anchor element */
	anchorStyle: JSX.CSSProperties
	/** Style props to spread on the positioned element */
	positionedStyle: (placement: Placement, gap?: number) => JSX.CSSProperties
}

// ============================================================================
// Anchor Name Generator
// ============================================================================

let anchorCounter = 0

/**
 * Generate a unique CSS anchor name
 * @param prefix - Optional prefix for the name (default: "anchor")
 * @returns A unique dashed-ident (e.g., "--anchor-1")
 */
export function createAnchorName(prefix = 'anchor'): string {
	return `--${prefix}-${++anchorCounter}`
}

/**
 * Reset the anchor counter (useful for testing)
 */
export function resetAnchorCounter(): void {
	anchorCounter = 0
}

// ============================================================================
// Placement Utilities
// ============================================================================

/** Map from Placement to CSS position-area value */
const placementToPositionArea: Record<Placement, PositionArea> = {
	top: 'top',
	'top-start': 'top start',
	'top-end': 'top end',
	bottom: 'bottom',
	'bottom-start': 'bottom start',
	'bottom-end': 'bottom end',
	left: 'left',
	'left-start': 'left start',
	'left-end': 'left end',
	right: 'right',
	'right-start': 'right start',
	'right-end': 'right end',
}

/** Map from Placement to the opposite placement for flipping */
const oppositePosition: Record<Placement, Placement> = {
	top: 'bottom',
	'top-start': 'bottom-start',
	'top-end': 'bottom-end',
	bottom: 'top',
	'bottom-start': 'top-start',
	'bottom-end': 'top-end',
	left: 'right',
	'left-start': 'right-start',
	'left-end': 'right-end',
	right: 'left',
	'right-start': 'left-start',
	'right-end': 'left-end',
}

/** Get the CSS position-area value for a placement */
export function getPositionArea(placement: Placement): PositionArea {
	return placementToPositionArea[placement]
}

/** Get the opposite placement */
export function getOppositePlacement(placement: Placement): Placement {
	return oppositePosition[placement]
}

/** Get the appropriate flip strategy based on placement axis */
export function getFlipStrategy(placement: Placement): FlipStrategy {
	if (placement.startsWith('top') || placement.startsWith('bottom')) {
		return 'flip-block'
	}
	return 'flip-inline'
}

/** Get margin property name based on placement (for gap between anchor and positioned element) */
export function getGapMargin(
	placement: Placement
): 'margin-bottom' | 'margin-top' | 'margin-left' | 'margin-right' {
	if (placement.startsWith('top')) return 'margin-bottom'
	if (placement.startsWith('bottom')) return 'margin-top'
	if (placement.startsWith('left')) return 'margin-right'
	return 'margin-left'
}

// ============================================================================
// Main Anchor Primitive
// ============================================================================

/**
 * Create an anchor relationship between two elements
 *
 * @example
 * ```tsx
 * const anchor = createAnchor()
 *
 * <button style={anchor.anchorStyle}>Trigger</button>
 * <div style={anchor.positionedStyle('top', 8)}>Tooltip</div>
 * ```
 */
export function createAnchor(options?: AnchorOptions): AnchorResult {
	const name = options?.name ?? createAnchorName(options?.prefix)

	return {
		name,
		anchorStyle: {
			'anchor-name': name,
		},
		positionedStyle: (placement: Placement, gap = 0) => ({
			position: 'fixed',
			'position-anchor': name,
			'position-area': getPositionArea(placement),
			'position-try-fallbacks': getFlipStrategy(placement),
			[getGapMargin(placement)]: gap > 0 ? `${gap}px` : undefined,
		}),
	}
}

// ============================================================================
// CSS Generation Utilities
// ============================================================================

/**
 * Generate inline style object for an anchor element
 */
export function anchorStyles(name: string): JSX.CSSProperties {
	return { 'anchor-name': name }
}

/**
 * Generate inline style object for a positioned element
 */
export function positionedStyles(
	anchorName: string,
	placement: Placement,
	options?: {
		gap?: number
		position?: 'fixed' | 'absolute'
	}
): JSX.CSSProperties {
	const { gap = 0, position = 'fixed' } = options ?? {}

	return {
		position,
		'position-anchor': anchorName,
		'position-area': getPositionArea(placement),
		'position-try-fallbacks': getFlipStrategy(placement),
		...(gap > 0 && { [getGapMargin(placement)]: `${gap}px` }),
	}
}

// ============================================================================
// Arrow Positioning
// ============================================================================

/** Get arrow position based on content placement */
export function getArrowPlacement(
	contentPlacement: Placement
): 'top' | 'bottom' | 'left' | 'right' {
	if (contentPlacement.startsWith('top')) return 'bottom'
	if (contentPlacement.startsWith('bottom')) return 'top'
	if (contentPlacement.startsWith('left')) return 'right'
	return 'left'
}

/** Get arrow alignment based on content placement */
export function getArrowAlignment(
	contentPlacement: Placement
): 'start' | 'center' | 'end' {
	if (contentPlacement.endsWith('-start')) return 'start'
	if (contentPlacement.endsWith('-end')) return 'end'
	return 'center'
}

// ============================================================================
// Safe Polygon for Submenu Navigation
// ============================================================================

export interface Point {
	x: number
	y: number
}

export interface Polygon {
	points: Point[]
}

/**
 * Create a safe polygon between a trigger element and a submenu content.
 * This polygon represents the "safe zone" where the mouse can travel
 * without closing the submenu.
 *
 * The polygon is a trapezoid/triangle shape extending from the cursor
 * position toward the submenu.
 */
export function createSafePolygon(
	triggerRect: DOMRect,
	contentRect: DOMRect,
	cursorPosition: Point,
	placement: 'left' | 'right' = 'right'
): Polygon {
	const padding = 5 // Extra padding for tolerance

	if (placement === 'right') {
		// Submenu is to the right of trigger
		return {
			points: [
				// Start from cursor
				cursorPosition,
				// Top of content (with padding)
				{ x: contentRect.left, y: contentRect.top - padding },
				// Bottom of content (with padding)
				{ x: contentRect.left, y: contentRect.bottom + padding },
			],
		}
	} else {
		// Submenu is to the left of trigger
		return {
			points: [
				// Start from cursor
				cursorPosition,
				// Top of content (with padding)
				{ x: contentRect.right, y: contentRect.top - padding },
				// Bottom of content (with padding)
				{ x: contentRect.right, y: contentRect.bottom + padding },
			],
		}
	}
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: Point, polygon: Polygon): boolean {
	const { points } = polygon
	const n = points.length
	let inside = false

	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = points[i]!.x
		const yi = points[i]!.y
		const xj = points[j]!.x
		const yj = points[j]!.y

		const intersect =
			yi > point.y !== yj > point.y &&
			point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

		if (intersect) {
			inside = !inside
		}
	}

	return inside
}

/**
 * Check if a point is inside a rectangle (bounding box)
 */
export function isPointInRect(point: Point, rect: DOMRect): boolean {
	return (
		point.x >= rect.left &&
		point.x <= rect.right &&
		point.y >= rect.top &&
		point.y <= rect.bottom
	)
}

export interface SafePolygonHandler {
	/** Update the polygon based on current rects and cursor */
	update: (
		triggerRect: DOMRect,
		contentRect: DOMRect,
		cursorPosition: Point
	) => void
	/** Check if a point is in the safe zone */
	isInSafeZone: (point: Point) => boolean
	/** Get the current polygon (for debugging) */
	getPolygon: () => Polygon | null
}

/**
 * Create a safe polygon handler for tracking mouse position
 * relative to a submenu.
 */
export function createSafePolygonHandler(
	placement: 'left' | 'right' = 'right'
): SafePolygonHandler {
	let currentPolygon: Polygon | null = null
	let currentContentRect: DOMRect | null = null

	return {
		update(triggerRect, contentRect, cursorPosition) {
			currentPolygon = createSafePolygon(
				triggerRect,
				contentRect,
				cursorPosition,
				placement
			)
			currentContentRect = contentRect
		},
		isInSafeZone(point) {
			// If in the content area, always safe
			if (currentContentRect && isPointInRect(point, currentContentRect)) {
				return true
			}
			// Otherwise check the polygon
			if (currentPolygon) {
				return isPointInPolygon(point, currentPolygon)
			}
			return false
		},
		getPolygon() {
			return currentPolygon
		},
	}
}
