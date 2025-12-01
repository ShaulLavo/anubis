interface LineGutterProps {
	lineNumber: number
	lineHeight: number
	isActive: boolean
}

export const LineGutter = (props: LineGutterProps) => {
	return (
		<span
			class="w-10 shrink-0 select-none text-right text-[11px] font-semibold tracking-[0.08em] tabular-nums flex items-center justify-end"
			classList={{
				'text-white': props.isActive,
				'text-zinc-500': !props.isActive
			}}
			style={{ height: `${props.lineHeight}px` }}
		>
			{props.lineNumber}
		</span>
	)
}

