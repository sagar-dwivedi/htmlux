import { Agent, ProxyAgent, request } from 'undici'

export interface RequestOptions {
	method?: 'GET' | 'POST'
	headers?: Record<string, string | string[]>
	body?: string | Buffer
	timeout?: number
	retries?: number
	proxy?: string
}

interface RequestResult {
	status: number
	headers: Record<string, string | string[]>
	text: () => Promise<string>
	json: <T = unknown>() => Promise<T>
	buffer: () => Promise<Buffer>
}

const USER_AGENTS = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

export class RequestManager {
	private agent: Agent
	private proxyAgent: ProxyAgent | null = null
	private currentProxy: string | null = null

	constructor() {
		this.agent = new Agent({
			connections: 128,
			pipelining: 10,
		})
	}

	private getProxyAgent(proxy: string): ProxyAgent {
		if (!this.proxyAgent || this.currentProxy !== proxy) {
			this.proxyAgent?.close?.()
			this.proxyAgent = new ProxyAgent(proxy)
			this.currentProxy = proxy
		}
		return this.proxyAgent
	}

	async fetch(
		url: string,
		options: RequestOptions = {},
	): Promise<RequestResult> {
		const {
			method = 'GET',
			headers = {},
			body,
			timeout = 30000,
			retries = 3,
			proxy,
		} = options

		const finalHeaders = {
			'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.9',
			'Accept-Encoding': 'gzip, deflate, br',
			...headers,
		}

		let lastError: Error | null = null

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const response = await request(url, {
					method,
					headers: finalHeaders,
					body,
					headersTimeout: timeout,
					bodyTimeout: timeout,
					dispatcher: proxy ? this.getProxyAgent(proxy) : this.agent,
				})

				const rawBody = await response.body.arrayBuffer()
				const bodyBuffer = Buffer.from(rawBody)

				return {
					status: response.statusCode,
					headers: response.headers as Record<string, string | string[]>,
					text: async () => bodyBuffer.toString('utf-8'),
					json: async <T = unknown>() =>
						JSON.parse(bodyBuffer.toString('utf-8')) as T,
					buffer: async () => bodyBuffer,
				}
			} catch (error) {
				lastError = error as Error

				if (attempt < retries) {
					const delay = Math.min(1000 * 2 ** attempt, 10000)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		throw new Error(
			`Request failed after ${retries + 1} attempts: ${lastError?.message}`,
		)
	}

	async get(
		url: string,
		options?: Omit<RequestOptions, 'method'>,
	): Promise<RequestResult> {
		return this.fetch(url, { ...options, method: 'GET' })
	}

	async post(
		url: string,
		options?: Omit<RequestOptions, 'method'>,
	): Promise<RequestResult> {
		return this.fetch(url, { ...options, method: 'POST' })
	}

	destroy(): void {
		this.agent.close?.()
		this.proxyAgent?.close?.()
	}
}
