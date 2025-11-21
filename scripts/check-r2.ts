import { exec } from 'node:child_process'
import { unlink } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { targets } from '../src/db/schema'

const execAsync = promisify(exec)

async function checkFile(path: string): Promise<boolean> {
  try {
    const tempFile = `data/r2/temp_${Math.random().toString(36).substring(7)}`
    await execAsync(`bun run wrangler r2 object get zzz-assets/${path} -f ${tempFile} --remote`)
    await unlink(tempFile).catch(() => {})
    return true
  }
  catch {
    return false
  }
}

async function main() {
  console.log('Checking R2 files against local DB...')

  const sqlite = new Database('drizzle/local.db')
  const db = drizzle(sqlite)

  const allTargets = await db.select().from(targets)
  const expectedFiles = allTargets
    .map(t => t.iconPath)
    .filter((p): p is string => !!p)

  console.log(`Found ${expectedFiles.length} targets with icon paths in DB.`)
  console.log('Checking existence in R2 (this may take a minute)...')

  const missingFiles: string[] = []
  const foundFiles: string[] = []

  const chunkSize = 5
  for (let i = 0; i < expectedFiles.length; i += chunkSize) {
    const chunk = expectedFiles.slice(i, i + chunkSize)
    const results = await Promise.all(chunk.map(async (file) => {
      const exists = await checkFile(file)
      process.stdout.write(exists ? '.' : 'X')
      return { file, exists }
    }))

    results.forEach((r) => {
      if (r.exists)
        foundFiles.push(r.file)
      else missingFiles.push(r.file)
    })
  }

  console.log('\n\nCheck complete.')
  console.log(`Found: ${foundFiles.length}`)
  console.log(`Missing: ${missingFiles.length}`)

  if (missingFiles.length > 0) {
    console.log('\nMissing files:')
    missingFiles.forEach(f => console.log(`- ${f}`))
  }
}

main()
