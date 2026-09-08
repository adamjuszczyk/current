// Confirms Phase 0.3's acceptance criterion against the live project:
// with no session, all four tables return no rows and reject writes.
//
// Usage: npm run verify:rls   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env)

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set up .env first.')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const writeProbes = {
  areas: { name: 'rls-probe' },
  blocks: { area_id: '00000000-0000-0000-0000-000000000000', name: 'rls-probe', x: 0, y: 0 },
  tasks: { block_id: '00000000-0000-0000-0000-000000000000', text: 'rls-probe' },
  notes: { area_id: '00000000-0000-0000-0000-000000000000', x: 0, y: 0 },
}

let ok = true

for (const [table, row] of Object.entries(writeProbes)) {
  const { data, error: readError } = await supabase.from(table).select('*')
  if (readError) {
    console.log(`${table}: read rejected (${readError.message})`)
  } else if ((data ?? []).length === 0) {
    console.log(`${table}: read returned no rows`)
  } else {
    console.log(`${table}: FAIL — read returned ${data.length} row(s) with no session`)
    ok = false
  }

  const { error: writeError } = await supabase.from(table).insert(row)
  if (writeError) {
    console.log(`${table}: write rejected (${writeError.message})`)
  } else {
    console.log(`${table}: FAIL — write with no session succeeded`)
    ok = false
  }
}

if (!ok) {
  console.error('\nRLS verification FAILED — see above.')
  process.exit(1)
}

console.log('\nRLS verification passed: no session, no reads, no writes.')
