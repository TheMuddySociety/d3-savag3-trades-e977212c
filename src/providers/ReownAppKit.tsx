import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { solana, solanaDevnet } from '@reown/appkit/networks';

const projectId = '336bea3a7584798217797f3b46943ac5';

const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

// Initialize AppKit once at module level
createAppKit({
  projectId,
  networks: [solana, solanaDevnet],
  adapters: [solanaAdapter],
  metadata: {
    name: 'SAVAG3BOT',
    description: 'Solana Memecoin Trading Terminal',
    url: 'https://memebot-profit-finder.lovable.app',
    icons: ['https://memebot-profit-finder.lovable.app/savag3bot-logo.png'],
  },
  features: {
    analytics: true,
    email: false,
    socials: false,
  },
});

// This component just ensures the module is imported (AppKit is initialized above)
export function ReownAppKitInit() {
  return null;
}
