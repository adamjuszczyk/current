import { MutationCache, QueryClient } from '@tanstack/react-query'
import { errorMessage } from './errorMessage'
import { useUIStore } from '../store/uiStore'

// Every mutation in the app reports failures through one place. Doing this
// on the cache rather than per-call-site means a write can never fail
// silently, including writes added later that forget to handle it — which
// matters most when the backend is misconfigured and *every* write is
// rejected, the state this app is in until Supabase is provisioned.
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      useUIStore.getState().pushError(errorMessage(error))
    },
  }),
})
