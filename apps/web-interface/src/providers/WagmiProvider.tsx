import type { ReactNode } from 'react'
import { WagmiProvider as WagmiProviderBase } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '../config/wagmi'

const queryClient = new QueryClient()

interface WagmiProviderProps {
  children: ReactNode
}

export function WagmiProvider({ children }: WagmiProviderProps) {
  return (
    <WagmiProviderBase config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProviderBase>
  )
} 