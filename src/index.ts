import type { ExtractResult, Schema } from './extractor'
import { extract as extractData } from './extractor'
import { RequestManager, type RequestOptions } from './fetcher'
import { type DocumentQuery, parseHTML } from './parser'

interface ScraperState<T extends Schema = Schema> {
	url?: string
	html?: string
	doc?: DocumentQuery
	data?: ExtractResult<T>
	requestOptions?: RequestOptions
	schema?: T
}

export class Scraper<T extends Schema = Schema> {
	private state: ScraperState<T> = {}
	private requestManager = new RequestManager()

	fetch(url: string, options?: RequestOptions): this {
		this.state.url = url
		this.state.requestOptions = options
		return this
	}

	html(html: string): this {
		this.state.html = html
		return this
	}

	parse(): this {
		if (!this.state.html) throw new Error('No HTML to parse.')
		this.state.doc = parseHTML(this.state.html)
		return this
	}

	extract(schema: T): this {
		this.state.schema = schema
		return this
	}

	async run(): Promise<ExtractResult<T> | DocumentQuery> {
		if (this.state.url && !this.state.html) {
			const res = await this.requestManager.get(
				this.state.url,
				this.state.requestOptions,
			)
			this.state.html = await res.text()
		}

		if (this.state.html && !this.state.doc) {
			this.state.doc = parseHTML(this.state.html)
		}

		if (this.state.doc && this.state.schema && !this.state.data) {
			this.state.data = extractData(this.state.doc, this.state.schema)
		}

		if (this.state.data) return this.state.data
		if (this.state.doc) return this.state.doc

		throw new Error('Scraper has neither document nor extracted data.')
	}

	getData(): ExtractResult<T> | undefined {
		return this.state.data
	}

	getDoc(): DocumentQuery | undefined {
		return this.state.doc
	}

	destroy(): void {
		this.requestManager.destroy()
		this.state = {}
	}
}

/** --- Convenience Wrappers --- */
export async function scrape<T extends Schema>(
	url: string,
	schema: T,
	options?: RequestOptions,
): Promise<ExtractResult<T>> {
	const scraper = new Scraper<T>()
	try {
		await scraper.fetch(url, options).extract(schema).run()
		const data = scraper.getData()
		if (!data) throw new Error('No data extracted.')
		return data
	} finally {
		scraper.destroy()
	}
}

export async function scrapeHTML<T extends Schema>(
	html: string,
	schema: T,
): Promise<ExtractResult<T>> {
	const scraper = new Scraper<T>()
	try {
		await scraper.html(html).extract(schema).run()
		const data = scraper.getData()
		if (!data) throw new Error('No data extracted.')
		return data
	} finally {
		scraper.destroy()
	}
}

export type { ExtractResult, Schema } from './extractor'
export { transform } from './extractor'
export type { RequestOptions } from './fetcher'
