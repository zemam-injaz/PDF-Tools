import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SubscriptionProvider } from './contexts/SubscriptionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </StrictMode>,
)
