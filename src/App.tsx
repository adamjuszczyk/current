import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoginScreen } from './auth/LoginScreen'
import { supabase } from './lib/supabase'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return null
  }

  if (!session) {
    return <LoginScreen />
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p>Signed in as {session.user.email}</p>
        <button type="button" onClick={() => supabase.auth.signOut()} className="mt-2 border px-2 py-1">
          Sign out
        </button>
      </div>
    </div>
  )
}

export default App
