export interface Token {
	type: 'open' | 'close' | 'text' | 'self-closing'
	tag?: string
	attrs?: Map<string, string>
	content?: string
}

/**
 * Tokenizes HTML string into a flat array of Tokens.
 * Handles comments, self-closing tags, nested tags, and script/style skipping.
 */
export function tokenize(html: string): Token[] {
	const tokens: Token[] = []
	const length = html.length
	let i = 0

	const selfClosingTags = new Set([
		'area',
		'base',
		'br',
		'col',
		'embed',
		'hr',
		'img',
		'input',
		'link',
		'meta',
		'param',
		'source',
		'track',
		'wbr',
	])

	while (i < length) {
		const lt = html.indexOf('<', i)

		// Text node
		if (lt === -1) {
			const text = html.slice(i)
			if (text) tokens.push({ type: 'text', content: text })
			break
		}

		if (lt > i) {
			const text = html.slice(i, lt)
			if (text) tokens.push({ type: 'text', content: text })
		}

		const gt = html.indexOf('>', lt + 1)
		if (gt === -1) break

		const tagRaw = html.slice(lt + 1, gt).trim()

		// Skip comments
		if (tagRaw.startsWith('!--')) {
			const endComment = html.indexOf('-->', lt + 4)
			i = endComment === -1 ? gt + 1 : endComment + 3
			continue
		}

		// Skip doctype/declarations
		if (tagRaw.startsWith('!')) {
			i = gt + 1
			continue
		}

		// Closing tag
		if (tagRaw.startsWith('/')) {
			const tagName = tagRaw.slice(1).trim().toLowerCase()
			if (tagName) tokens.push({ type: 'close', tag: tagName })
			i = gt + 1
			continue
		}

		// Opening / self-closing tag
		const nameMatch = tagRaw.match(/^([a-zA-Z0-9-_:]+)/)
		if (!nameMatch || !nameMatch[1]) {
			i = gt + 1
			continue
		}
		const tag = nameMatch[1].toLowerCase()

		// Skip <script> and <style> blocks
		if (tag === 'script' || tag === 'style') {
			const closeIdx = html.indexOf(`</${tag}>`, gt + 1)
			i = closeIdx === -1 ? gt + 1 : closeIdx + tag.length + 3
			continue
		}

		// Parse attributes
		const attrs = new Map<string, string>()
		const attrPart = tagRaw
			.slice(tag.length)
			.trim()
			.replace(/\/\s*$/, '')
		if (attrPart) {
			const attrRegex =
				/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
			let m: RegExpExecArray | null = attrRegex.exec(attrPart)

			while (m !== null) {
				const name = m[1]?.toLowerCase()
				const value = m[2] ?? m[3] ?? m[4] ?? ''

				if (name) {
					attrs.set(name, value)
				}

				m = attrRegex.exec(attrPart)
			}
		}

		// Determine type
		const isSelfClosing = /\/\s*$/.test(tagRaw) || selfClosingTags.has(tag)

		tokens.push({
			type: isSelfClosing ? 'self-closing' : 'open',
			tag,
			attrs: attrs.size ? attrs : undefined,
		})

		i = gt + 1
	}

	return tokens
}
