import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider'
import { ErrorBanner } from './components/ErrorBanner'
import './index.css'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmDialogProvider>
        <ErrorBanner />
        <App />
      </ConfirmDialogProvider>
    </QueryClientProvider>
  </StrictMode>,
)
