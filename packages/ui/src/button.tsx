import type { JSX, ParentComponent } from 'solid-js'

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button: ParentComponent<ButtonProps> = props => (
	<button {...props}>{props.children}</button>
)
