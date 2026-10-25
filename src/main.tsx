import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SubscriptionProvider } from './contexts/SubscriptionContext.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { installNativeReaderBridge } from './lib/nativeReaderBridge.ts'

void installNativeReaderBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SubscriptionProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </SubscriptionProvider>
  </StrictMode>,
)
