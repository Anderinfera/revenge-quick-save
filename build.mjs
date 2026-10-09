// Copies each plugin from src/ to docs/ and writes the sha256 of index.js into its manifest.
// docs/ is what gets served (GitHub Pages / raw.githubusercontent).
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

for (const plug of readdirSync('src')) {
	const js = readFileSync(`src/${plug}/index.js`, 'utf8')
	// Vendetta evaluates `return ${js}`: it must parse, and must not start with a comment
	// or newline (automatic semicolon insertion would turn it into a bare `return;`).
	new Function('vendetta', `return ${js}`)
	if (!js.startsWith('(')) throw new Error(`${plug}: index.js must start with "("`)

	const manifest = JSON.parse(readFileSync(`src/${plug}/manifest.json`, 'utf8'))
	manifest.hash = createHash('sha256').update(js).digest('hex')
	manifest.main = 'index.js'

	mkdirSync(`docs/${plug}`, { recursive: true })
	writeFileSync(`docs/${plug}/index.js`, js)
	writeFileSync(`docs/${plug}/manifest.json`, JSON.stringify(manifest, null, '\t'))
	console.log(`built ${plug} (${manifest.hash.slice(0, 8)})`)
}
