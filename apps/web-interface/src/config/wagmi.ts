import { http, createConfig } from 'wagmi'
import { etherlinkTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [etherlinkTestnet],
  connectors: [
    injected(),
  ],
  transports: {
    [etherlinkTestnet.id]: http('https://node.ghostnet.etherlink.com'),
  },
}) 