import { type Schema, scrape, transform } from '.'

// --- 1️⃣ Define the schema ---
const bookSchema = {
	title: { selector: '.m-desc h1.tit', transform: transform.trim },
	author: {
		selector: '.m-imgtxt .item:first-child a.a1',
		transform: transform.trim,
	},
	genres: {
		selector: '.m-imgtxt .item:nth-child(2) a.a1',
		multiple: true,
		transform: transform.split(','), // split multiple genres
	},
	status: {
		selector: '.m-imgtxt .item:last-child .s1.s2',
		transform: transform.trim,
	},
	description: {
		selector: '.m-desc .txt .inner',
		attr: 'html',
		transform: transform.trim,
	},
	cover: {
		selector: '.m-imgtxt .pic img',
		attr: 'src',
		transform: transform.trim,
	},
	chapters: {
		selector: '.btn.flex-center a.js-link',
		multiple: true,
		fields: {
			title: { selector: 'span', transform: transform.trim }, // chapter title
			url: { selector: '@href', transform: transform.trim }, // chapter link
		},
	},
} as const satisfies Schema

// --- 2️⃣ Run the scraper ---
async function runScraper() {
	try {
		const bookData = await scrape(
			'https://freewebnovel.com/novel/legendary-fbi-detective',
			bookSchema,
		)

		console.log('✅ Extracted Book Data:')
		console.log(JSON.stringify(bookData, null, 2))
	} catch (err) {
		console.error('❌ Error scraping the book page:', err)
	}
}

// --- 3️⃣ Execute ---
runScraper()
