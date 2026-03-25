# D3S Custom Smart Contracts

Four Anchor programs powering the D3 Savage Trades platform, targeting **Solana Devnet** first.

## Programs

| Program | Description | Program ID |
|---------|-------------|------------|
| **Beach Delegator** | Wallet delegation with spending caps for autonomous Beach Mode | `D3SBchDe1egator...` |
| **Fee Collector** | Platform fee collection (0.5%) with referral splits | `D3SFeeC011ect0r...` |
| **Escrow Vault** | SOL deposit vault with withdrawal limits and cooldowns | `D3SEscr0wVau1t...` |
| **Token Launcher** | Bonding curve token launches (Pump.fun style) | `D3ST0kenLaunch...` |

## Prerequisites

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1
avm use 0.30.1

# Configure for devnet
solana config set --url devnet
solana-keygen new  # if no keypair exists
solana airdrop 5   # get devnet SOL
```

## Build & Deploy

```bash
cd programs

# Build all programs
anchor build

# Deploy to devnet
anchor deploy --program-name beach_delegator
anchor deploy --program-name fee_collector
anchor deploy --program-name escrow_vault
anchor deploy --program-name token_launcher

# Or deploy all at once
anchor run deploy-all
```

## After Deployment

1. Copy the deployed program IDs from the output
2. Update the program IDs in:
   - Each `programs/*/src/lib.rs` (`declare_id!`)
   - Each `src/services/contracts/*.ts` (constant at top)
   - `programs/Anchor.toml` (`[programs.devnet]`)
3. Rebuild and redeploy with the correct IDs

## TypeScript Client SDKs

Import from the app:

```typescript
import {
  createInitializeDelegationInstruction,
  createCollectFeeInstruction,
  createDepositInstruction,
  createBuyInstruction,
  estimateTokensOut,
} from '@/services/contracts';
```

## Architecture

```
programs/
├── Anchor.toml            # Workspace config
├── Cargo.toml             # Workspace members
├── beach-delegator/       # PDA delegation + spending caps
├── fee-collector/         # Swap fee collection + referrals
├── escrow-vault/          # SOL deposit vault for agent trading
└── token-launcher/        # Bonding curve token launches

src/services/contracts/
├── index.ts               # Barrel exports
├── beachDelegator.ts      # Beach Delegator SDK
├── feeCollector.ts        # Fee Collector SDK
├── escrowVault.ts         # Escrow Vault SDK
└── tokenLauncher.ts       # Token Launcher SDK
```
