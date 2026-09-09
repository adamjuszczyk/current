// Confirms Phase 0.3's acceptance criterion against the live project:
// with no session, all four tables return no rows and reject writes, and
// email signup (which would let a stranger create a second account and
// pass the owner-UID policy by being a *different* signed-in user) is
// rejected.
//
// Usage: npm run verify:rls   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env)
//
// This script distinguishes three outcomes, not two. A probe that never
// reached PostgREST proves nothing, and must never be counted as a pass:
// an earlier version treated every error as "rejected" and reported a
// clean pass while an egress allowlist was blocking the host and not one
// request left the machine.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set up .env first.')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

// A genuine PostgREST error carries a `code`. A transport failure — proxy
// refusal, DNS, offline — surfaces as a message with no code, or as a JSON
// parse error from a non-JSON body.
const isPostgrestError = (error) => typeof error?.code === 'string' && error.code.length > 0

const writeProbes = {
  areas: { name: 'rls-probe' },
  blocks: { area_id: '00000000-0000-0000-0000-000000000000', name: 'rls-probe', x: 0, y: 0 },
  tasks: { block_id: '00000000-0000-0000-0000-000000000000', text: 'rls-probe' },
  notes: { area_id: '00000000-0000-0000-0000-000000000000', x: 0, y: 0 },
}

let failed = false
let inconclusive = false

const unreachable = (label, detail) => {
  console.log(`${label}: UNREACHABLE — ${detail}`)
  inconclusive = true
}

for (const [table, row] of Object.entries(writeProbes)) {
  // Read: under a restrictive policy PostgREST returns 200 with an empty
  // array, not an error. An error here is only meaningful if it is one.
  const { data, error: readError } = await supabase.from(table).select('*')
  if (readError) {
    if (isPostgrestError(readError)) {
      console.log(`${table}: read rejected (${readError.code}: ${readError.message})`)
    } else {
      unreachable(`${table} read`, readError.message)
    }
  } else if ((data ?? []).length === 0) {
    console.log(`${table}: read returned no rows`)
  } else {
    console.log(`${table}: FAIL — read returned ${data.length} row(s) with no session`)
    failed = true
  }

  // Write: a genuine RLS refusal is 42501 (insufficient_privilege).
  const { error: writeError } = await supabase.from(table).insert(row)
  if (!writeError) {
    console.log(`${table}: FAIL — write with no session succeeded`)
    failed = true
  } else if (isPostgrestError(writeError)) {
    console.log(`${table}: write rejected (${writeError.code}: ${writeError.message})`)
  } else {
    unreachable(`${table} write`, writeError.message)
  }
}

// Signup: only an auth-layer refusal counts. A transport failure here
// previously read as "signups are disabled", which is how the whole
// script came to report a pass having verified nothing.
const throwawayEmail = `rls-probe-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: throwawayEmail,
  password: 'rls-probe-password-1',
})

if (signUpError) {
  const status = signUpError.status ?? 0
  if (status >= 400 && status < 500) {
    console.log(`signup: rejected (${status} ${signUpError.code ?? ''} ${signUpError.message})`.trimEnd())
  } else {
    unreachable('signup', signUpError.message)
  }
} else if (signUpData.user) {
  console.log('signup: FAIL — email signup succeeded; a stranger can create a second account')
  failed = true
} else {
  console.log('signup: rejected (no user returned)')
}

if (failed) {
  console.error('\nRLS verification FAILED — a probe above got through when it should not have.')
  process.exit(1)
}

if (inconclusive) {
  console.error(
    `\nRLS verification INCONCLUSIVE — one or more probes never reached ${url}, so nothing was proved.\n` +
      'This is not a pass. Check network egress to the Supabase host, then re-run.',
  )
  process.exit(2)
}

console.log('\nRLS verification passed: no session means no reads/writes, and email signup is rejected.')
console.log('Note: this confirms signup is refused, not why. Confirm the Auth setting in the dashboard too.')
