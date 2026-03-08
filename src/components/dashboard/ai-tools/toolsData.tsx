import { Zap, Activity, Layers, Gauge, Cpu, Code, Shield, Bot, Blocks, GitBranch, Search } from "lucide-react";

export type ToolCategory = "all" | "skills" | "frameworks" | "security" | "infra";

export interface AITool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: React.ReactNode;
  tags: string[];
  url: string;
  profitRange: string;
  minFunding: string;
  timeframe: string;
  setupSteps: string[];
  marketCondition: string;
}

export const tools: AITool[] = [
  {
    id: "clawpump-arbitrage",
    name: "ClawPump Arbitrage Skill",
    description: "Multi-DEX arbitrage on Solana — 11 DEX quote aggregation, roundtrip & bridge strategies, ready-to-sign tx bundles.",
    category: "skills",
    icon: <Zap className="h-5 w-5" />,
    tags: ["Arbitrage", "DEX", "Trading"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/clawpump-arbitrage",
    profitRange: "$200 – $100,000+",
    minFunding: "$50 – $1,000",
    timeframe: "Minutes to hours (24/7)",
    setupSteps: [
      "Clone repo: git clone https://github.com/solana-foundation/solana-ai-skills",
      "cd skills/clawpump-arbitrage && npm install",
      "Set RPC_URL, PRIVATE_KEY, BIRDEYE_API_KEY in .env",
      "Configure DEX list and min-profit thresholds in config.json",
      "Run: npm start — bot scans 11 DEXs for spread opportunities"
    ],
    marketCondition: "All conditions — thrives on volatility & liquidity fragmentation",
  },
  {
    id: "jupiter-skill",
    name: "Jupiter Skill",
    description: "Ultra swaps, limit orders, DCA, perpetuals, lending, and token APIs on Solana via Jupiter.",
    category: "skills",
    icon: <Activity className="h-5 w-5" />,
    tags: ["Jupiter", "Swaps", "DCA"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/jupiter",
    profitRange: "$50 – $25,000+",
    minFunding: "$5 – $500",
    timeframe: "Daily DCA to weekly limit orders",
    setupSteps: [
      "Clone repo: git clone https://github.com/solana-foundation/solana-ai-skills",
      "cd skills/jupiter && npm install",
      "Set JUPITER_API_KEY (free at jup.ag) and SOLANA_RPC in .env",
      "Configure DCA strategy: token pair, amount, frequency in config.ts",
      "Run: npx ts-node index.ts — executes swaps/DCA automatically"
    ],
    marketCondition: "Bull & sideways — DCA smooths entry; limit orders catch dips",
  },
  {
    id: "meteora-skill",
    name: "Meteora Skill",
    description: "Meteora DeFi SDK — liquidity pools, AMMs, bonding curves, vaults, and token launches.",
    category: "skills",
    icon: <Layers className="h-5 w-5" />,
    tags: ["Meteora", "DeFi", "AMM"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/meteora",
    profitRange: "$100 – $50,000+",
    minFunding: "$20 – $1,000",
    timeframe: "1–30 days (LP yield farming)",
    setupSteps: [
      "Clone repo: git clone https://github.com/solana-foundation/solana-ai-skills",
      "cd skills/meteora && npm install",
      "Set SOLANA_RPC and wallet PRIVATE_KEY in .env",
      "Choose pool strategy: DLMM, dynamic AMM, or vault in config",
      "Run: npm start — auto-manages LP positions and rebalances"
    ],
    marketCondition: "All conditions — earns fees in sideways; amplifies gains in bull",
  },
  {
    id: "pumpfun-skill",
    name: "PumpFun Skill",
    description: "Token launches, bonding curves, and PumpSwap AMM integrations on Solana.",
    category: "skills",
    icon: <Gauge className="h-5 w-5" />,
    tags: ["PumpFun", "Launches", "AMM"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/pumpfun",
    profitRange: "$50 – $100,000+",
    minFunding: "$5 – $200",
    timeframe: "Minutes to days (early entry critical)",
    setupSteps: [
      "Clone repo: git clone https://github.com/solana-foundation/solana-ai-skills",
      "cd skills/pumpfun && npm install",
      "Set SOLANA_RPC, PRIVATE_KEY, HELIUS_API_KEY in .env",
      "Configure snipe settings: max buy, sell targets in config.json",
      "Run: npm start — monitors new launches and auto-enters positions"
    ],
    marketCondition: "Bull & hype cycles — best during memecoin seasons",
  },
  {
    id: "helius-skill",
    name: "Helius Skill",
    description: "Helius RPC & API infra — DAS API, Enhanced Transactions, Priority Fees, Webhooks, LaserStream gRPC.",
    category: "infra",
    icon: <Cpu className="h-5 w-5" />,
    tags: ["Helius", "RPC", "Webhooks"],
    url: "https://github.com/helius-labs/helius-sdk",
    profitRange: "Infrastructure — enables $50–$100K+ strategies",
    minFunding: "Free tier available",
    timeframe: "Always-on infrastructure",
    setupSteps: [
      "npm install helius-sdk",
      "Get API key at helius.dev (free tier: 100K credits/day)",
      "Initialize: const helius = new Helius('YOUR_API_KEY')",
      "Use DAS API for token metadata, webhooks for real-time alerts",
      "Integrate with trading bots for priority fee optimization"
    ],
    marketCondition: "All conditions — infrastructure layer for all strategies",
  },
  {
    id: "pyth-skill",
    name: "Pyth Skill",
    description: "Pyth Network oracle — real-time price feeds with confidence intervals and EMA prices.",
    category: "infra",
    icon: <Activity className="h-5 w-5" />,
    tags: ["Pyth", "Oracle", "Prices"],
    url: "https://github.com/pyth-network/pyth-sdk-solidity",
    profitRange: "Infrastructure — powers $100–$50K+ strategies",
    minFunding: "Free (on-chain oracle)",
    timeframe: "Real-time price data",
    setupSteps: [
      "npm install @pythnetwork/pyth-solana-receiver",
      "Get price feed IDs from pyth.network/price-feeds",
      "Subscribe to SOL/USD, BTC/USD or any supported pair",
      "Use confidence intervals for risk management decisions",
      "Integrate with arbitrage/trading bots for accurate pricing"
    ],
    marketCondition: "All conditions — accurate pricing prevents bad trades",
  },
  {
    id: "solana-dev-skill",
    name: "Solana Dev Skill (Rent-Free)",
    description: "Client & Anchor/Pinocchio program dev without rent-exemption for DeFi, payments, ZK programs & debugging.",
    category: "skills",
    icon: <Code className="h-5 w-5" />,
    tags: ["Anchor", "Programs", "ZK"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/solana-dev",
    profitRange: "$500 – $100,000+ (custom program deployment)",
    minFunding: "$10 – $100 (deployment costs)",
    timeframe: "1–7 days development cycle",
    setupSteps: [
      "Install Solana CLI: sh -c \"$(curl -sSfL https://release.solana.com/stable/install)\"",
      "Install Anchor: cargo install --git https://github.com/coral-xyz/anchor anchor-cli",
      "Clone skill: git clone + cd skills/solana-dev",
      "Use AI skill to generate/audit Anchor programs",
      "Deploy to devnet first, then mainnet with proper testing"
    ],
    marketCondition: "All conditions — build custom protocols for any market",
  },
  {
    id: "squads-skill",
    name: "Squads Skill",
    description: "Squads Protocol — multisig wallets, smart accounts, and account abstraction on Solana.",
    category: "skills",
    icon: <Shield className="h-5 w-5" />,
    tags: ["Multisig", "Squads", "Security"],
    url: "https://github.com/Squads-Protocol/v4",
    profitRange: "Security layer — protects $1K–$100K+ portfolios",
    minFunding: "$5 – $50 (setup tx fees)",
    timeframe: "Setup in 1 day, ongoing protection",
    setupSteps: [
      "npm install @sqds/multisig",
      "Create multisig: define members and threshold (e.g., 2-of-3)",
      "Configure vault for automated trading fund management",
      "Set spending limits and approval workflows",
      "Integrate with trading bots — transactions require multisig approval"
    ],
    marketCondition: "All conditions — security is always critical",
  },
  {
    id: "solana-agent-kit",
    name: "Solana Agent Kit",
    description: "Open-source toolkit connecting AI agents to 30+ protocols with 50+ actions. Compatible with Eliza, LangChain, Vercel AI SDK.",
    category: "frameworks",
    icon: <Bot className="h-5 w-5" />,
    tags: ["Agent Kit", "LangChain", "Eliza"],
    url: "https://github.com/sendaifun/solana-agent-kit",
    profitRange: "$100 – $100,000+",
    minFunding: "$10 – $500",
    timeframe: "24/7 autonomous trading",
    setupSteps: [
      "npm install solana-agent-kit",
      "Set OPENAI_API_KEY, SOLANA_RPC, PRIVATE_KEY in .env",
      "Initialize agent with desired protocols (Jupiter, Meteora, etc.)",
      "Define trading strategy in natural language or code",
      "Run agent: it autonomously executes swaps, LPs, and monitors positions"
    ],
    marketCondition: "All conditions — AI adapts strategy to market state",
  },
  {
    id: "eliza-framework",
    name: "Eliza Framework",
    description: "Lightweight TypeScript AI agent framework with Solana integrations, Twitter/X bots, and character-based config.",
    category: "frameworks",
    icon: <Bot className="h-5 w-5" />,
    tags: ["Eliza", "TypeScript", "Bots"],
    url: "https://github.com/elizaOS/eliza",
    profitRange: "$50 – $50,000+",
    minFunding: "$5 – $200",
    timeframe: "24/7 social + trading automation",
    setupSteps: [
      "git clone https://github.com/elizaOS/eliza && cd eliza",
      "pnpm install && pnpm build",
      "Configure character file with Solana trading personality",
      "Set TWITTER_API keys for social signal detection",
      "pnpm start — agent trades based on social sentiment + on-chain data"
    ],
    marketCondition: "Bull & hype — excels at sentiment-driven memecoin trading",
  },
  {
    id: "solana-developer-mcp",
    name: "Solana Developer MCP",
    description: "Official Solana MCP for AI-supported IDEs — queries up-to-date Solana & Anchor docs automatically.",
    category: "frameworks",
    icon: <Blocks className="h-5 w-5" />,
    tags: ["MCP", "Cursor", "Docs"],
    url: "https://github.com/nicholasoxford/solana-developer-mcp",
    profitRange: "Dev tool — accelerates building $1K–$100K+ bots",
    minFunding: "Free",
    timeframe: "Instant setup, ongoing dev use",
    setupSteps: [
      "Add to Cursor/Windsurf MCP config: { \"solana\": { \"command\": \"npx\", \"args\": [\"solana-developer-mcp\"] } }",
      "Restart your IDE to activate the MCP server",
      "Ask AI questions about Solana/Anchor development",
      "MCP auto-fetches latest docs, examples, and API references",
      "Use to rapidly build and debug trading bots"
    ],
    marketCondition: "All conditions — development accelerator",
  },
  {
    id: "solana-kit-migration",
    name: "Solana Kit Migration Skill",
    description: "Migrate from @solana/web3.js v1.x to @solana/kit with API mappings and edge case handling.",
    category: "skills",
    icon: <GitBranch className="h-5 w-5" />,
    tags: ["Migration", "web3.js", "Kit"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/solana-kit-migration",
    profitRange: "Dev tool — modernizes bots for better performance",
    minFunding: "Free",
    timeframe: "1–3 days migration",
    setupSteps: [
      "Clone skill repo and review migration mappings",
      "Run migration analyzer on your existing codebase",
      "Apply automated transforms for common patterns",
      "Manually handle edge cases flagged by the tool",
      "Test migrated code on devnet before mainnet deployment"
    ],
    marketCondition: "All conditions — improves existing bot infrastructure",
  },
  {
    id: "pinocchio-skill",
    name: "Pinocchio Skill",
    description: "Zero-dependency zero-copy framework for high-performance Solana programs — 88-95% compute unit reduction.",
    category: "skills",
    icon: <Gauge className="h-5 w-5" />,
    tags: ["Pinocchio", "Performance", "Programs"],
    url: "https://github.com/anza-xyz/pinocchio",
    profitRange: "$500 – $100,000+ (gas savings compound)",
    minFunding: "$10 – $100 (deployment)",
    timeframe: "3–7 days development",
    setupSteps: [
      "cargo add pinocchio",
      "Replace Anchor boilerplate with Pinocchio zero-copy patterns",
      "Use AI skill to convert existing programs automatically",
      "88-95% compute unit reduction = cheaper transactions",
      "Deploy optimized programs for high-frequency trading bots"
    ],
    marketCondition: "All conditions — lower costs = higher net profit margins",
  },
  {
    id: "vulnhunter-skill",
    name: "VulnHunter Skill",
    description: "Security vulnerability detection, dangerous API hunting, and variant analysis across Solana codebases.",
    category: "security",
    icon: <Shield className="h-5 w-5" />,
    tags: ["Security", "Audit", "Vulnerabilities"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/vulnhunter",
    profitRange: "Risk prevention — protects $100–$100K+ positions",
    minFunding: "Free (open-source)",
    timeframe: "Hours per audit",
    setupSteps: [
      "Clone: git clone solana-ai-skills && cd skills/vulnhunter",
      "Point scanner at target contract address or repo",
      "Run: npm start -- --target <contract_address>",
      "Review vulnerability report: reentrancy, overflow, access control",
      "Use findings to avoid rugged tokens or secure your own programs"
    ],
    marketCondition: "All conditions — security auditing prevents losses",
  },
  {
    id: "code-recon-skill",
    name: "Code Recon Skill",
    description: "Deep architectural context building for security audits — mapping trust boundaries and vulnerability analysis.",
    category: "security",
    icon: <Search className="h-5 w-5" />,
    tags: ["Security", "Audit", "Architecture"],
    url: "https://github.com/solana-foundation/solana-ai-skills/tree/main/skills/code-recon",
    profitRange: "Risk prevention — protects $500–$100K+ investments",
    minFunding: "Free (open-source)",
    timeframe: "1–3 days deep analysis",
    setupSteps: [
      "Clone: git clone solana-ai-skills && cd skills/code-recon",
      "Feed target protocol source code or GitHub URL",
      "Run architectural analysis: npm start -- --repo <url>",
      "Review trust boundary map and attack surface report",
      "Use before investing large amounts in any DeFi protocol"
    ],
    marketCondition: "All conditions — due diligence before deployment",
  },
  {
    id: "surfpool-skill",
    name: "Surfpool Skill",
    description: "Solana dev environment with mainnet forking, cheatcodes, and Infrastructure as Code.",
    category: "infra",
    icon: <Cpu className="h-5 w-5" />,
    tags: ["Surfpool", "DevEnv", "Forking"],
    url: "https://github.com/txtx/surfpool",
    profitRange: "Dev tool — test strategies risk-free before deploying",
    minFunding: "Free (local development)",
    timeframe: "Setup in 1 hour",
    setupSteps: [
      "Install: curl -sSL https://install.surfpool.dev | bash",
      "Fork mainnet state: surfpool fork --rpc <mainnet_rpc>",
      "Test trading strategies against real mainnet data locally",
      "Use cheatcodes to simulate market conditions (price spikes, crashes)",
      "Deploy proven strategies to mainnet with confidence"
    ],
    marketCondition: "All conditions — risk-free strategy testing environment",
  },
  {
    id: "mev-sandwich-shield",
    name: "MEV Sandwich Shield",
    description: "Detect and protect against MEV sandwich attacks on Solana — monitors mempool activity, flags suspicious bundled txs, and routes swaps through private RPCs.",
    category: "security",
    icon: <Shield className="h-5 w-5" />,
    tags: ["MEV", "Sandwich", "Protection", "Security"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
    profitRange: "Loss prevention — saves $50–$50,000+ per trade",
    minFunding: "Free (open-source)",
    timeframe: "Always-on protection",
    setupSteps: [
      "Clone repo and install: git clone <repo> && cd mev-shield && npm install",
      "Set SOLANA_RPC (Jito or private RPC recommended) and PRIVATE_KEY in .env",
      "Configure protection mode: detect-only, auto-reroute, or Jito bundle in config.json",
      "Run: npm start — monitors pending txs for sandwich patterns in real-time",
      "Integrate with your swap pipeline to auto-route trades through protected paths"
    ],
    marketCondition: "All conditions — MEV attacks increase during high-volume periods",
  },
  {
    id: "raydium-sniper",
    name: "Raydium Sniper Skill",
    description: "Snipe new token launches on Raydium DEX — monitors pool creation events, auto-buys at launch, and sets take-profit/stop-loss targets.",
    category: "skills",
    icon: <Zap className="h-5 w-5" />,
    tags: ["Raydium", "Sniping", "Launches", "DEX"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
    profitRange: "$100 – $500,000+",
    minFunding: "$10 – $500",
    timeframe: "Seconds to minutes (speed is critical)",
    setupSteps: [
      "Clone repo: git clone <repo> && cd raydium-sniper && npm install",
      "Set SOLANA_RPC (low-latency RPC required), PRIVATE_KEY in .env",
      "Configure snipe params: max buy SOL, slippage, TP/SL targets in config.json",
      "Run: npm start — listens for Raydium pool creation txs in real-time",
      "Bot auto-buys on pool init and manages position with configured exit strategy"
    ],
    marketCondition: "Bull & hype cycles — highest returns during memecoin launch waves",
  },
];

export const categoryLabels: Record<ToolCategory, string> = {
  all: "All",
  skills: "AI Skills",
  frameworks: "Frameworks",
  security: "Security",
  infra: "Infrastructure",
};

export const categoryIcons: Record<ToolCategory, React.ReactNode> = {
  all: <Blocks className="h-3.5 w-3.5" />,
  skills: <Code className="h-3.5 w-3.5" />,
  frameworks: <Bot className="h-3.5 w-3.5" />,
  security: <Shield className="h-3.5 w-3.5" />,
  infra: <Cpu className="h-3.5 w-3.5" />,
};
