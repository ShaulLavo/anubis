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

export const replaceDirNodeInTree = (
	current: FsDirTreeNode,
	targetPath: string,
	replacement: FsDirTreeNode
): FsDirTreeNode => {
	if (current.path === targetPath) {
		return replacement
	}

	let changed = false
	const children = current.children.map((child) => {
		if (child.kind !== 'dir') return child
		const shouldDescend =
			child.path === targetPath || targetPath.startsWith(`${child.path}/`)
		if (!shouldDescend) return child
		const next = replaceDirNodeInTree(child, targetPath, replacement)
		if (next !== child) {
			changed = true
		}
		return next
	})

	if (!changed) {
		return current
	}

	return {
		...current,
		children,
	}
}

/**
 * Batch replace multiple directory nodes in a single tree traversal.
 * Much more efficient than calling replaceDirNodeInTree multiple times.
 */
export const batchReplaceDirNodes = (
	current: FsDirTreeNode,
	replacements: Map<string, FsDirTreeNode>
): FsDirTreeNode => {
	if (replacements.size === 0) return current

	// Check if current node should be replaced
	const replacement = replacements.get(current.path)
	if (replacement) {
		// Remove from map since we found it
		replacements.delete(current.path)
		// If no more replacements, return the replacement directly
		if (replacements.size === 0) return replacement
		// Otherwise, continue processing children of the replacement
		return batchReplaceDirNodes(replacement, replacements)
	}

	// Check which children might contain targets
	let changed = false
	const children = current.children.map((child) => {
		if (child.kind !== 'dir') return child
		if (replacements.size === 0) return child

		// Check if this child is a target or contains a target
		const childReplacement = replacements.get(child.path)
		if (childReplacement) {
			replacements.delete(child.path)
			changed = true
			// If the replacement has children that need processing, recurse
			if (replacements.size > 0) {
				return batchReplaceDirNodes(childReplacement, replacements)
			}
			return childReplacement
		}

		// Check if any remaining targets are under this child
		let hasTargetBelow = false
		for (const targetPath of replacements.keys()) {
			if (targetPath.startsWith(`${child.path}/`)) {
				hasTargetBelow = true
				break
			}
		}

		if (!hasTargetBelow) return child

		const next = batchReplaceDirNodes(child, replacements)
		if (next !== child) {
			changed = true
		}
		return next
	})

	if (!changed) {
		return current
	}

	return {
		...current,
		children,
	}
}

export const countLoadedDirectories = (root?: FsDirTreeNode) => {
	if (!root) return 0
	let count = 0
	const stack: FsDirTreeNode[] = [root]
	while (stack.length) {
		const dir = stack.pop()!
		if (dir.isLoaded !== false) {
			count += 1
		}
		for (const child of dir.children) {
			if (child.kind === 'dir') {
				stack.push(child)
			}
		}
	}
	return count
}
