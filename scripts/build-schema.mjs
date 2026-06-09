// Builds supabase_setup.sql by concatenating the migrations in supabase/migrations/
// in order. The migrations are the single source of truth for the schema; this script
// produces the one-paste file the README points new users at, so the two never drift.
//
//   npm run build:schema     regenerate after adding a migration
//   npm run check:schema     fail if supabase_setup.sql is out of date (used in CI)
//
// Run with --check to compare against the committed file instead of writing it.
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')
const outFile = join(root, 'supabase_setup.sql')

const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

const banner = `-- ============================================================================
-- supabase_setup.sql
--
-- GENERATED FILE -- do not edit by hand.
-- Built from supabase/migrations/ (the source of truth) by scripts/build-schema.mjs.
-- To stand up a fresh database, paste this whole file into the Supabase SQL editor.
-- To regenerate after adding a migration: npm run build:schema
-- ============================================================================
`

const sections = files.map(f => {
  const body = readFileSync(join(migrationsDir, f), 'utf8').trim()
  return `-- >>> supabase/migrations/${f}\n\n${body}\n`
})

const output = [banner, ...sections].join('\n')

if (process.argv.includes('--check')) {
  const current = readFileSync(outFile, 'utf8')
  if (current !== output) {
    console.error('supabase_setup.sql is out of date. Run: npm run build:schema')
    process.exit(1)
  }
  console.log('supabase_setup.sql is up to date.')
} else {
  writeFileSync(outFile, output)
  console.log(`Wrote supabase_setup.sql from ${files.length} migration(s).`)
}
