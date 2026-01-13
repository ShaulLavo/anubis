import type { FsDirTreeNode } from '@repo/fs'

export const normalizeDirNodeMetadata = (
	node: FsDirTreeNode,
	parentPath: string | undefined,
	depth: number
): FsDirTreeNode => {
	const childParentPath = node.path || undefined
	return {
		...node,
		parentPath,
		depth,
		children: node.children.map((child) => {
			if (child.kind === 'dir') {
				return normalizeDirNodeMetadata(child, childParentPath, depth + 1)
			}

			return {
				...child,
				parentPath: childParentPath,
				depth: depth + 1,
			}
		}),
	}
}
