/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SOURCE = path.join(process.cwd(), '.github', 'copilot-instructions.md')
const DEST_ANTIGRAVITY = path.join(process.cwd(), 'rules', 'default.md')
const DEST_CURSOR = path.join(process.cwd(), 'rules', 'default.mdc')

const ANTIGRAVITY_HEADER = `---
trigger: always_on
---

`

const CURSOR_HEADER = `---
alwaysApply: true
---

`

try {
  const content = fs.readFileSync(SOURCE, 'utf8')

  fs.writeFileSync(DEST_ANTIGRAVITY, ANTIGRAVITY_HEADER + content)
  console.log(`Updated ${DEST_ANTIGRAVITY}`)

  fs.writeFileSync(DEST_CURSOR, CURSOR_HEADER + content)
  console.log(`Updated ${DEST_CURSOR}`)
}
catch (error) {
  console.error('Error syncing rules:', error)
  process.exit(1)
}
