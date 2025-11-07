import type { DocumentQuery, QueryElement } from './parser'

/** --- Types --- */

export type ExtractAttr = 'text' | 'html' | string

export type TransformFn<T = unknown, R = unknown> = (val: T) => R

export interface SingleFieldSchema<R = unknown> {
	selector: string
	attr?: ExtractAttr
	default?: R
	transform?: TransformFn<unknown, R>
	multiple?: false
}

export interface MultipleFieldSchema<R = unknown> {
	selector: string
	attr?: ExtractAttr
	default?: R[]
	transform?: TransformFn<unknown[], R[]>
	multiple: true
	limit?: number
}

export interface NestedFieldSchema<T extends Schema = Schema> {
	selector: string
	fields: T
	multiple?: boolean
	limit?: number
	attr?: never
	transform?: never
}

export type FieldSchema =
	| SingleFieldSchema
	| MultipleFieldSchema
	| NestedFieldSchema

export type Schema = Record<string, FieldSchema>

export type ExtractResult<T extends Schema> = {
	[K in keyof T]: T[K] extends { multiple: true }
		? T[K] extends NestedFieldSchema<infer S>
			? ExtractResult<S>[]
			: T[K] extends MultipleFieldSchema<infer R>
				? R[]
				: unknown[]
		: T[K] extends NestedFieldSchema<infer S>
			? ExtractResult<S> | null
			: T[K] extends SingleFieldSchema<infer R>
				? R | null
				: unknown | null
}

/** --- Extractor Class --- */
export class Extractor<T extends Schema> {
	constructor(private readonly doc: DocumentQuery) {}

	extract(schema: T): ExtractResult<T> {
		const result = {} as ExtractResult<T>
		for (const key in schema) {
			const field = schema[key]
			if (!field) continue
			try {
				result[key] = this.extractField(
					field,
					this.doc,
				) as ExtractResult<T>[typeof key]
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				throw new Error(`Field "${String(key)}": ${msg}`)
			}
		}
		return result
	}

	private extractField(
		field: FieldSchema,
		ctx: DocumentQuery | QueryElement,
	): unknown {
		if (this.isNested(field)) {
			const isMultiple = field.multiple ?? false
			return isMultiple
				? this.extractMultipleNested(field, ctx)
				: this.extractSingleNested(field, ctx)
		}

		return field.multiple
			? this.extractMultipleSimple(field, ctx)
			: this.extractSingleSimple(field, ctx)
	}

	private isNested(field: FieldSchema): field is NestedFieldSchema {
		return 'fields' in field
	}

	private extractSingleSimple(
		f: SingleFieldSchema,
		ctx: DocumentQuery | QueryElement,
	): unknown {
		const el = ctx.selectOne(f.selector)
		const raw = el
			? this.extractValue(el, f.attr ?? 'text')
			: (f.default ?? null)
		return f.transform ? this.safeTransform(f.transform, raw) : raw
	}

	private extractMultipleSimple(
		f: MultipleFieldSchema,
		ctx: DocumentQuery | QueryElement,
	): unknown[] {
		const els = ctx.select(f.selector)
		const limited = f.limit ? els.slice(0, f.limit) : els
		const raw =
			limited.length > 0
				? limited
						.map((el) => this.extractValue(el, f.attr ?? 'text'))
						.filter((v) => v != null)
				: (f.default ?? [])
		return f.transform ? this.safeTransform(f.transform, raw) : raw
	}

	private extractSingleNested(
		f: NestedFieldSchema,
		ctx: DocumentQuery | QueryElement,
	): unknown {
		const el = ctx.selectOne(f.selector)
		return el ? this.buildNestedObject(f.fields, el) : null
	}

	private extractMultipleNested(
		f: NestedFieldSchema,
		ctx: DocumentQuery | QueryElement,
	): unknown[] {
		const els = ctx.select(f.selector)
		const limited = f.limit ? els.slice(0, f.limit) : els
		return limited.map((el) => this.buildNestedObject(f.fields, el))
	}

	private buildNestedObject<S extends Schema>(
		fields: S,
		el: QueryElement,
	): ExtractResult<S> {
		const obj = {} as ExtractResult<S>
		for (const key in fields) {
			const sub = fields[key]
			if (!sub) continue
			obj[key] = this.extractField(sub, el) as ExtractResult<S>[typeof key]
		}
		return obj
	}

	private extractValue(el: QueryElement, attr: ExtractAttr): string | null {
		if (attr === 'text') return el.text()
		if (attr === 'html') return el.html()
		return el.attr(attr)
	}

	private safeTransform<T, R>(fn: TransformFn<T, R>, val: T): R {
		try {
			return fn(val)
		} catch (err) {
			throw new Error(
				`Transform failed: ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}
}

/** --- Transform Helpers --- */
export const transform = {
	trim: (val: unknown): string => (typeof val === 'string' ? val.trim() : ''),
	lowercase: (val: unknown): string =>
		typeof val === 'string' ? val.toLowerCase() : '',
	uppercase: (val: unknown): string =>
		typeof val === 'string' ? val.toUpperCase() : '',
	number: (val: unknown): number | null => {
		if (typeof val !== 'string') return null
		const n = parseFloat(val.replace(/[^0-9.-]/g, ''))
		return Number.isNaN(n) ? null : n
	},
	int: (val: unknown): number | null => {
		if (typeof val !== 'string') return null
		const n = parseInt(val.replace(/[^0-9-]/g, ''), 10)
		return Number.isNaN(n) ? null : n
	},
	boolean: (val: unknown): boolean => {
		if (typeof val !== 'string') return false
		const v = val.toLowerCase().trim()
		return v === 'true' || v === '1' || v === 'yes'
	},
	date: (val: unknown): string | null => {
		if (typeof val !== 'string') return null
		const d = new Date(val)
		return Number.isNaN(d.getTime()) ? null : d.toISOString()
	},
	url:
		(base: string): ((val: unknown) => string | null) =>
		(val: unknown) => {
			if (!val || typeof val !== 'string') return null
			if (val.startsWith('http')) return val
			try {
				return new URL(val, base).href
			} catch {
				return null
			}
		},
	split:
		(delimiter: string): ((val: unknown) => string[]) =>
		(val: unknown): string[] => {
			if (typeof val !== 'string') return []
			return val
				.split(delimiter)
				.map((v) => v.trim())
				.filter(Boolean)
		},
	match:
		(regex: RegExp): ((val: unknown) => string | null) =>
		(val: unknown) => {
			if (typeof val !== 'string') return null
			const m = val.match(regex)
			return m ? (m[1] ?? m[0]) : null
		},
	replace:
		(
			pattern: RegExp | string,
			replacement: string,
		): ((val: unknown) => string | null) =>
		(val: unknown): string => {
			if (typeof val !== 'string') return ''
			return val.replace(pattern, replacement)
		},
	chain:
		(...fns: TransformFn[]): TransformFn<unknown, unknown> =>
		(val: unknown) =>
			fns.reduce((acc, fn) => fn(acc), val),
} as const

/** --- Convenience function --- */
export function extract<T extends Schema>(
	doc: DocumentQuery,
	schema: T,
): ExtractResult<T> {
	return new Extractor<T>(doc).extract(schema)
}
