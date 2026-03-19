import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solana, solanaDevnet } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '336bea3a7584798217797f3b46943ac5';

// No explicit wallet adapters – AppKit auto-discovers installed wallets (Phantom, Solflare, etc.)
const solanaAdapter = new SolanaAdapter();

createAppKit({
  projectId,
  networks: [solana, solanaDevnet] as any,
  adapters: [solanaAdapter],
  metadata: {
    name: 'D3MON Dan',
    description: 'Your Personal AI Trading Agent on Solana',
    url: window.location.origin,
    icons: ['https://savag3.trades/dan-logo.png'],
  },
  features: {
    analytics: true,
    email: true,
    socials: ['google', 'x', 'discord', 'apple'],
    emailShowWallets: true,
    onramp: true,
  },
});

export function ReownAppKitInit() {
  return null;
}
