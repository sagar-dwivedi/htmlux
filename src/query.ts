import type { Node } from './dom'

// Caches so we don't mutate Node instances or use `any`
const classListCache = new WeakMap<Node, string[]>()
const tagLowerCache = new WeakMap<Node, string>()

/* Precompile a simple selector into a fast matcher function */
function compileMatcher(selector: string): (node: Node) => boolean {
	// ID selector: #id
	if (selector.startsWith('#')) {
		const id = selector.slice(1)
		return (node) => node.attrs.get('id') === id
	}

	// Class selector: .class
	if (selector.startsWith('.')) {
		const cls = selector.slice(1)
		return (node) => {
			let list = classListCache.get(node)
			if (!list) {
				const raw = node.attrs.get('class') ?? ''
				list = raw.split(/\s+/).filter(Boolean)
				classListCache.set(node, list)
			}
			return list.includes(cls)
		}
	}

	// Attribute selectors: [attr] or [attr=value]
	const attrMatch = selector.match(
		/^\[([a-zA-Z0-9_-]+)(?:=["']?([^"'\]]+)["']?)?\]$/,
	)

	if (attrMatch) {
		const [, name = '', expected] = attrMatch

		if (expected === undefined) {
			// [attr]
			return (node) => node.attrs.has(name)
		}

		// [attr=value]
		return (node) => node.attrs.get(name) === expected
	}

	// Tag selector
	const tag = selector.toLowerCase()
	return (node) => {
		let cached = tagLowerCache.get(node)
		if (!cached) {
			cached = node.tag.toLowerCase()
			tagLowerCache.set(node, cached)
		}
		return cached === tag
	}
}

/* Fast descendant-only querySelectorAll */
export function querySelectorAll(root: Node, selector: string): Node[] {
	const parts = selector.trim().split(/\s+/)

	const matchers: Array<(node: Node) => boolean> = parts.map((p) =>
		compileMatcher(p),
	)

	const results: Node[] = []

	const stack: Array<{ node: Node; index: number }> = [{ node: root, index: 0 }]

	while (stack.length > 0) {
		// Safe pop: no `!` needed
		const popped = stack.pop()
		if (!popped) continue

		const { node, index } = popped

		const matcher = matchers[index]
		if (!matcher) continue

		if (!node.children) continue

		const nextIndex = index + 1
		const isLast = nextIndex === matchers.length

		for (const child of node.children) {
			if (!child) continue

			if (matcher(child)) {
				if (isLast) {
					results.push(child)
				} else {
					stack.push({ node: child, index: nextIndex })
				}
			}

			stack.push({ node: child, index })
		}
	}

	return results
}
