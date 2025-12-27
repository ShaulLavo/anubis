import type { FsDirTreeNode, FsTreeNode } from '@repo/fs'

export const getParentPath = (path: string): string => {
	const lastSlash = path.lastIndexOf('/')
	return lastSlash === -1 ? '' : path.slice(0, lastSlash)
}

export const getNodeName = (path: string): string => {
	const lastSlash = path.lastIndexOf('/')
	return lastSlash === -1 ? path : path.slice(lastSlash + 1)
}

export const sortChildrenInPlace = (children: FsTreeNode[]): void => {
	children.sort((a, b) => {
		if (a.kind === 'dir' && b.kind !== 'dir') return -1
		if (a.kind !== 'dir' && b.kind === 'dir') return 1
		return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
	})
}

export const findNodeInTree = (
	tree: FsDirTreeNode,
	path: string
): FsTreeNode | undefined => {
	if (tree.path === path) return tree
	for (const child of tree.children) {
		if (child.path === path) return child
		if (child.kind === 'dir' && path.startsWith(`${child.path}/`)) {
			return findNodeInTree(child, path)
		}
	}
	return undefined
}

export const findParentNode = (
	tree: FsDirTreeNode,
	parentPath: string
): FsDirTreeNode | undefined => {
	if (tree.path === parentPath || (!parentPath && !tree.path)) {
		return tree
	}
	const node = findNodeInTree(tree, parentPath)
	return node?.kind === 'dir' ? node : undefined
}

export const updateDescendantPathsInPlace = (
	node: FsTreeNode,
	oldPrefix: string,
	newPrefix: string
): void => {
	node.path = node.path.replace(oldPrefix, newPrefix)
	node.parentPath = getParentPath(node.path) || undefined

	if (node.kind === 'dir') {
		for (const child of node.children) {
			updateDescendantPathsInPlace(child, oldPrefix, newPrefix)
		}
	}
}
