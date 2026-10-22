// Builds the plugins, packs each into repo/pool/<id>@<version>.zip (manifest.json + index.js at the root,
// same layout as the template's Gradle packaging) and regenerates repo/index.json.
// Revenge Next: Settings > Revenge > Plugins > gear > add repository URL (raw .../next/repo/index.json).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { zipSync } from 'fflate'

const BASE_URL = 'https://raw.githubusercontent.com/Anderinfera/revenge-quick-save/main/next/repo/pool'
const cli = (...args) => execFileSync(process.execPath, ['.cli/bin/revenge-plugin.js', ...args], { stdio: 'inherit' })

cli('build')
mkdirSync('repo/pool', { recursive: true })
for (const dir of readdirSync('plugins')) {
	const manifestBytes = readFileSync(`plugins/${dir}/manifest.json`)
	const { id, version } = JSON.parse(manifestBytes)
	const zip = zipSync(
		{ 'manifest.json': manifestBytes, 'index.js': readFileSync(`plugins/${dir}/build/js/index.js`) },
		{ mtime: new Date('2026-01-01T00:00:00Z') }, // fixed time: same input -> same sha256
	)
	writeFileSync(`repo/pool/${id}@${version}.zip`, zip)
	console.log(`packed ${id}@${version}`)
}
cli('generate-index', '--dist', 'repo/pool', '--base-url', BASE_URL, '--out', 'repo/index.json')
