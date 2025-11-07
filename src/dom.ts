import type { Token } from './tokenizer'

export class Node {
	tag: string
	attrs: Map<string, string>
	children: Node[]
	text: string
	parent: Node | null

	constructor(
		tag = '',
		attrs: Map<string, string> = new Map(),
		text = '',
		parent: Node | null = null,
	) {
		this.tag = tag
		this.attrs = attrs
		this.children = []
		this.text = text
		this.parent = parent
	}

	/** Recursively returns all text content */
	getText(): string {
		if (this.text) return this.text
		return this.children.map((c) => c.getText()).join('')
	}

	/** Returns inner HTML of this node */
	getInnerHTML(): string {
		return this.children.map((c) => c.toString()).join('')
	}

	/** Converts node back to HTML string */
	toString(): string {
		if (this.text) return this.text

		const attrs = [...this.attrs.entries()]
			.map(([k, v]) => `${k}="${v}"`)
			.join(' ')
		const attrStr = attrs ? ` ${attrs}` : ''

		return `<${this.tag}${attrStr}>${this.getInnerHTML()}</${this.tag}>`
	}

	/** Makes Node iterable (for convenient tree traversal) */
	*[Symbol.iterator](): IterableIterator<Node> {
		for (const child of this.children) yield child
	}
}

/** Builds a DOM tree from tokens */
export function buildTree(tokens: Token[]): Node {
	const root = new Node('document')
	const stack: Node[] = [root]

	for (const token of tokens) {
		// stack always has at least one element
		const current = stack[stack.length - 1]
		if (!current) continue

		switch (token.type) {
			case 'text': {
				if (!token.content) break
				current.children.push(new Node('', new Map(), token.content, current))
				break
			}

			case 'open':
			case 'self-closing': {
				const node = new Node(
					token.tag ?? '',
					token.attrs ?? new Map(),
					'',
					current,
				)
				current.children.push(node)

				if (token.type === 'open') {
					stack.push(node)
				}
				break
			}

			case 'close': {
				if (stack.length > 1 && stack[stack.length - 1]?.tag === token.tag) {
					stack.pop()
				}
				break
			}
		}
	}

	return root
}
