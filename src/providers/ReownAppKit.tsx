import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solana, solanaDevnet } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit';

const projectId = '336bea3a7584798217797f3b46943ac5';

// No explicit wallet adapters – AppKit auto-discovers installed wallets (Phantom, Solflare, etc.)
const solanaAdapter = new SolanaAdapter();

createAppKit({
  projectId,
  networks: [solana as AppKitNetwork, solanaDevnet as AppKitNetwork],
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

export function ReownAppKitInit() {
  return null;
}
