import { buildTree, type Node } from './dom'
import { querySelectorAll } from './query'
import { tokenize } from './tokenizer'

/** --- Query Interfaces --- */
export interface QueryElement {
	text(): string
	html(): string
	attr(name: string): string | null
	attrs(): Record<string, string>
	select(selector: string): QueryElement[]
	selectOne(selector: string): QueryElement | null
	exists(): boolean
}

export interface DocumentQuery {
	select(selector: string): QueryElement[]
	selectOne(selector: string): QueryElement | null
	title(): string
	html(): string
}

/** --- Element Wrapper --- */
class ElementWrapper implements QueryElement {
	constructor(private node: Node) {}

	text(): string {
		return this.node.getText().trim()
	}

	html(): string {
		return this.node.getInnerHTML()
	}

	attr(name: string): string | null {
		return this.node.attrs.get(name) ?? null
	}

	attrs(): Record<string, string> {
		return Object.fromEntries(this.node.attrs)
	}

	select(selector: string): QueryElement[] {
		return querySelectorAll(this.node, selector).map(
			(n) => new ElementWrapper(n),
		)
	}

	selectOne(selector: string): QueryElement | null {
		const nodes = querySelectorAll(this.node, selector)
		if (nodes.length === 0) return null
		const first = nodes[0]
		// Add explicit null check
		if (!first) return null
		return new ElementWrapper(first)
	}

	exists(): boolean {
		return true
	}
}

/** --- Document Wrapper --- */
class DocumentWrapper implements DocumentQuery {
	constructor(private root: Node) {}

	select(selector: string): QueryElement[] {
		return querySelectorAll(this.root, selector).map(
			(n) => new ElementWrapper(n),
		)
	}

	selectOne(selector: string): QueryElement | null {
		const nodes = querySelectorAll(this.root, selector)
		if (nodes.length === 0) return null
		const first = nodes[0]
		// Add explicit null check
		if (!first) return null
		return new ElementWrapper(first)
	}

	title(): string {
		const titleNodes = querySelectorAll(this.root, 'title')
		const titleNode = titleNodes[0]
		return titleNode ? titleNode.getText().trim() : ''
	}

	html(): string {
		return this.root.getInnerHTML()
	}
}

/** --- Parse HTML string into DocumentQuery --- */
export function parseHTML(html: string): DocumentQuery {
	const tokens = tokenize(html)
	const tree = buildTree(tokens)
	return new DocumentWrapper(tree)
}
