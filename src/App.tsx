import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoginScreen } from './auth/LoginScreen'
import { AreaTabs } from './components/AreaTabs'
import { Canvas } from './components/Canvas'
import { FocusScreen } from './components/FocusScreen'
import { useAreas } from './lib/areas'
import { errorMessage } from './lib/errorMessage'
import { supabase } from './lib/supabase'
import { useUIStore } from './store/uiStore'

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

  return <Workspace email={session.user.email ?? ''} />
}

// Area tab row plus the Canvas for the active Area below it (empty state
// when there are no Areas at all, per 2.4's fallback).
function Workspace({ email }: { email: string }) {
  const { data: areas = [], isPending, isError, error, refetch } = useAreas()
  const activeAreaId = useUIStore((s) => s.activeAreaId)
  const activeArea = areas.find((area) => area.id === activeAreaId)
  const activeView = useUIStore((s) => s.activeView)
  const setActiveView = useUIStore((s) => s.setActiveView)

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <AreaTabs />
          <button
            type="button"
            onClick={() => setActiveView(activeView === 'focus' ? 'canvas' : 'focus')}
            aria-pressed={activeView === 'focus'}
            className={`border px-3 py-1 ${activeView === 'focus' ? 'bg-black text-white' : ''}`}
          >
            Focus
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>{email}</span>
          <button type="button" onClick={() => supabase.auth.signOut()} className="border px-2 py-1">
            Sign out
          </button>
        </div>
      </div>
      {isPending ? (
        <p className="p-4 text-gray-500">Loading areas…</p>
      ) : isError ? (
        <div className="p-4 text-red-700">
          <p className="font-medium">Couldn&apos;t load your areas.</p>
          <p className="text-sm">{errorMessage(error)}</p>
          <p className="mt-1 text-sm text-gray-600">
            This is a loading failure, not an empty account — nothing has been lost.
          </p>
          <button type="button" onClick={() => void refetch()} className="mt-2 border px-2 py-1 text-sm text-black">
            Try again
          </button>
        </div>
      ) : activeView === 'focus' ? (
        <FocusScreen />
      ) : areas.length === 0 ? (
        <p className="p-4 text-gray-500">No areas yet — create one above to get started.</p>
      ) : (
        activeArea && <Canvas areaId={activeArea.id} />
      )}
    </div>
  )
}

export default App
