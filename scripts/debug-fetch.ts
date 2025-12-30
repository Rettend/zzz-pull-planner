/* eslint-disable no-console */
import { writeFile } from 'node:fs/promises'

const AGENT_HISTORY_URL = 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Exclusive_Channel/History&prop=text&format=json'
const ENGINE_HISTORY_URL = 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=W-Engine_Channel/History&prop=text&format=json'
const VERSION = '2.5'

async function fetchWikiPage(url: string, filename: string) {
  console.log(`Fetching ${url}...`)
  const res = await fetch(url)
  const json = await res.json() as any
  const html = json.parse.text['*']
  await writeFile(filename, html)
  console.log(`Saved to ${filename}`)
}

async function main() {
  await fetchWikiPage(AGENT_HISTORY_URL, 'data/debug-agent.html')
  await fetchWikiPage(ENGINE_HISTORY_URL, 'data/debug-engine.html')
  await fetchWikiPage(`https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Version/${VERSION}&prop=text&format=json`, 'data/debug-version.html')
}

main()
