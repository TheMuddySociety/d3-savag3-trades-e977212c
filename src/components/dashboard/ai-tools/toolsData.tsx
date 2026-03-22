import { Zap, Activity, Shield, Bot, Crosshair, Clock, BarChart3, Rocket, Eye, Brain, Layers, Gauge, Search, History as HistoryIcon } from "lucide-react";

export type ToolCategory = "all" | "trading" | "analysis" | "security" | "automation";

export interface AITool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: React.ReactNode;
  tags: string[];
  status: "active" | "coming-soon";
  /** Maps to a BotAccess tab value — clicking the card activates this tab */
  tabKey?: string;
}

export const tools: AITool[] = [
  {
    id: "sniper-bot",
    name: "Token Sniper",
    description: "Instantly buy new tokens on launch. Auto-detect pool creation and snipe with configurable slippage and amounts.",
    category: "trading",
    icon: <Crosshair className="h-5 w-5" />,
    tags: ["Sniping", "Launches", "Speed"],
    status: "active",
    tabKey: "sniper",
  },
  {
    id: "dca-bot",
    name: "Smart DCA",
    description: "Dollar-cost average into any token with flexible intervals. Set schedules, amounts, and auto-rebalance targets.",
    category: "trading",
    icon: <Clock className="h-5 w-5" />,
    tags: ["DCA", "Recurring", "Strategy"],
    status: "active",
    tabKey: "dca",
  },
  {
    id: "volume-bot",
    name: "Volume Bot",
    description: "Generate organic-looking volume across multiple wallets. Configurable trade sizes, intervals, and randomization.",
    category: "trading",
    icon: <BarChart3 className="h-5 w-5" />,
    tags: ["Volume", "Market Making"],
    status: "active",
    tabKey: "volume",
  },
  {
    id: "grid-bot",
    name: "Grid Trading",
    description: "Automated buy/sell grid across price ranges. Profit from sideways markets with configurable grid levels and spacing.",
    category: "trading",
    icon: <Layers className="h-5 w-5" />,
    tags: ["Grid", "Range", "Passive"],
    status: "active",
    tabKey: "grid",
  },
  {
    id: "copy-trade",
    name: "Copy Trading",
    description: "Follow top wallets and mirror their trades. Paste any wallet address and auto-copy entries and exits in real time.",
    category: "automation",
    icon: <Eye className="h-5 w-5" />,
    tags: ["Copy", "Follow", "Mirror"],
    status: "active",
    tabKey: "copy",
  },
  {
    id: "d3mon-dan",
    name: "D3S Agent",
    description: "Delegate long-term tasks to D3S Agent. The agent will monitor prices and execute swaps based on your custom rules while you're offline.",
    category: "automation",
    icon: <HistoryIcon className="h-5 w-5" />,
    tags: ["Automation", "Rules", "24/7"],
    status: "active",
    tabKey: "agent",
  },
  {
    id: "token-launch",
    name: "Token Launcher",
    description: "Launch your own token on Jupiter Studio with custom bonding curves, metadata, and optional background processing.",
    category: "trading",
    icon: <Rocket className="h-5 w-5" />,
    tags: ["Launch", "Studio", "Bonding"],
    status: "active",
    tabKey: "launch",
  },
  {
    id: "ultra-swap",
    name: "Jupiter Ultra Swaps",
    description: "Connect D3S Agent to Jupiter Ultra for high-frequency, MEV-protected swaps with zero platform fees.",
    category: "trading",
    icon: <Zap className="h-5 w-5" />,
    tags: ["Trading", "Fast", "Jup"],
    status: "active",
    tabKey: "sniper",
  },
  {
    id: "v6-swap",
    name: "Jupiter V6 Engine",
    description: "Advanced swap flow using custom RPC and API keys. Full control with address lookup tables and versioned transactions.",
    category: "trading",
    icon: <Activity className="h-5 w-5" />,
    tags: ["V6", "Custom RPC", "Pro"],
    status: "active",
    tabKey: "sniper",
  },
  {
    id: "price-watcher",
    name: "Price Watcher",
    description: "Monitor token prices with configurable thresholds. Get alerted and auto-execute swaps when targets are met.",
    category: "analysis",
    icon: <Gauge className="h-5 w-5" />,
    tags: ["Alerts", "Threshold", "Monitor"],
    status: "active",
    tabKey: "auto",
  },
  {
    id: "mev-shield",
    name: "MEV Shield",
    description: "Protection against sandwich attacks and MEV extraction. Routes swaps through Jito bundles and protected RPCs.",
    category: "security",
    icon: <Shield className="h-5 w-5" />,
    tags: ["MEV", "Jito", "Protection"],
    status: "active",
  },
  {
    id: "profit-sim",
    name: "Profit Simulator",
    description: "Simulate potential returns before committing funds. Model different scenarios with custom entry/exit strategies.",
    category: "analysis",
    icon: <Search className="h-5 w-5" />,
    tags: ["Simulate", "Backtest", "Plan"],
    status: "active",
    tabKey: "profit",
  },
  {
    id: "batch-trader",
    name: "Batch Trader",
    description: "Execute multiple swaps in a single batch. Buy or sell across multiple tokens simultaneously to save time.",
    category: "trading",
    icon: <Bot className="h-5 w-5" />,
    tags: ["Batch", "Multi-Token"],
    status: "active",
    tabKey: "batch",
  },
  {
    id: "background-tasks",
    name: "Background Cloud Mode",
    description: "Queue trades and token launches for D3S Agent to execute in the background while you're away. 24/7 operation.",
    category: "automation",
    icon: <Bot className="h-5 w-5" />,
    tags: ["Background", "Queue", "24/7"],
    status: "active",
    tabKey: "auto",
  },
];

export const categoryLabels: Record<ToolCategory, string> = {
  all: "All",
  trading: "Trading",
  analysis: "Analysis",
  security: "Security",
  automation: "Automation",
};

export const categoryIcons: Record<ToolCategory, React.ReactNode> = {
  all: <Layers className="h-3.5 w-3.5" />,
  trading: <Zap className="h-3.5 w-3.5" />,
  analysis: <Search className="h-3.5 w-3.5" />,
  security: <Shield className="h-3.5 w-3.5" />,
  automation: <Bot className="h-3.5 w-3.5" />,
};
