import { type Component, type JSX, mergeProps } from 'solid-js'
import { clsx } from 'clsx'

export const enum AutoHideVisibility {
	SHOW = 'show',
	HIDE = 'hide',
	AUTO = 'auto',
}

export interface AutoHideWrapperProps extends JSX.HTMLAttributes<HTMLDivElement> {
	visibility: AutoHideVisibility
}

export const AutoHideWrapper: Component<AutoHideWrapperProps> = (props) => {
	const merged = mergeProps(
		{
			visibility: 'auto' as AutoHideVisibility,
		},
		props
	)

	return (
		<div
			class={clsx(
				'transition-opacity duration-300',
				{
					// SHOW: Always visible
					'opacity-100': merged.visibility === 'show',

					// HIDE: Hidden and no pointer events
					'opacity-0 pointer-events-none': merged.visibility === 'hide',

					// AUTO: Hidden by default, visible on hover
					'opacity-0 hover:opacity-100': merged.visibility === 'auto',
				},
				props.class
			)}
			{...props}
		>
			{props.children}
		</div>
	)
}
