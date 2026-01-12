import { type Component } from 'solid-js'

interface DurationProps {
	ms: number
	class?: string
}

/**
 * Formats a duration in milliseconds with appropriate units
 */
export const Duration: Component<DurationProps> = (props) => {
	const formatted = () => {
		const ms = props.ms
		if (ms < 1) {
			return `${(ms * 1000).toFixed(0)}μs`
		}
		if (ms < 1000) {
			return `${ms.toFixed(2)}ms`
		}
		return `${(ms / 1000).toFixed(2)}s`
	}

	const colorClass = () => {
		const ms = props.ms
		if (ms < 16) return 'text-green-400' // Under 1 frame at 60fps
		if (ms < 100) return 'text-yellow-400'
		return 'text-red-400'
	}

	return (
		<span class={`font-mono ${colorClass()} ${props.class ?? ''}`}>
			{formatted()}
		</span>
	)
}
