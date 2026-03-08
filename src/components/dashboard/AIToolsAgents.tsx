import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Zap, Shield, Code, Search, ExternalLink, Cpu, Layers, Activity, Gauge, Blocks, GitBranch } from "lucide-react";

type ToolCategory = "all" | "skills" | "frameworks" | "security" | "infra";

interface AITool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: React.ReactNode;
  tags: string[];
  url: string;
}

const tools: AITool[] = [
  {
    id: "clawpump-arbitrage",
    name: "ClawPump Arbitrage Skill",
    description: "Multi-DEX arbitrage on Solana — 11 DEX quote aggregation, roundtrip & bridge strategies, ready-to-sign tx bundles.",
    category: "skills",
    icon: <Zap className="h-5 w-5" />,
    tags: ["Arbitrage", "DEX", "Trading"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "jupiter-skill",
    name: "Jupiter Skill",
    description: "Ultra swaps, limit orders, DCA, perpetuals, lending, and token APIs on Solana via Jupiter.",
    category: "skills",
    icon: <Activity className="h-5 w-5" />,
    tags: ["Jupiter", "Swaps", "DCA"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "meteora-skill",
    name: "Meteora Skill",
    description: "Meteora DeFi SDK — liquidity pools, AMMs, bonding curves, vaults, and token launches.",
    category: "skills",
    icon: <Layers className="h-5 w-5" />,
    tags: ["Meteora", "DeFi", "AMM"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "pumpfun-skill",
    name: "PumpFun Skill",
    description: "Token launches, bonding curves, and PumpSwap AMM integrations on Solana.",
    category: "skills",
    icon: <Gauge className="h-5 w-5" />,
    tags: ["PumpFun", "Launches", "AMM"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "helius-skill",
    name: "Helius Skill",
    description: "Helius RPC & API infra — DAS API, Enhanced Transactions, Priority Fees, Webhooks, LaserStream gRPC.",
    category: "infra",
    icon: <Cpu className="h-5 w-5" />,
    tags: ["Helius", "RPC", "Webhooks"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "pyth-skill",
    name: "Pyth Skill",
    description: "Pyth Network oracle — real-time price feeds with confidence intervals and EMA prices.",
    category: "infra",
    icon: <Activity className="h-5 w-5" />,
    tags: ["Pyth", "Oracle", "Prices"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "solana-dev-skill",
    name: "Solana Dev Skill (Rent-Free)",
    description: "Client & Anchor/Pinocchio program dev without rent-exemption for DeFi, payments, ZK programs & debugging.",
    category: "skills",
    icon: <Code className="h-5 w-5" />,
    tags: ["Anchor", "Programs", "ZK"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "squads-skill",
    name: "Squads Skill",
    description: "Squads Protocol — multisig wallets, smart accounts, and account abstraction on Solana.",
    category: "skills",
    icon: <Shield className="h-5 w-5" />,
    tags: ["Multisig", "Squads", "Security"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "solana-agent-kit",
    name: "Solana Agent Kit",
    description: "Open-source toolkit connecting AI agents to 30+ protocols with 50+ actions. Compatible with Eliza, LangChain, Vercel AI SDK.",
    category: "frameworks",
    icon: <Bot className="h-5 w-5" />,
    tags: ["Agent Kit", "LangChain", "Eliza"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "eliza-framework",
    name: "Eliza Framework",
    description: "Lightweight TypeScript AI agent framework with Solana integrations, Twitter/X bots, and character-based config.",
    category: "frameworks",
    icon: <Bot className="h-5 w-5" />,
    tags: ["Eliza", "TypeScript", "Bots"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "solana-developer-mcp",
    name: "Solana Developer MCP",
    description: "Official Solana MCP for AI-supported IDEs — queries up-to-date Solana & Anchor docs automatically.",
    category: "frameworks",
    icon: <Blocks className="h-5 w-5" />,
    tags: ["MCP", "Cursor", "Docs"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "solana-kit-migration",
    name: "Solana Kit Migration Skill",
    description: "Migrate from @solana/web3.js v1.x to @solana/kit with API mappings and edge case handling.",
    category: "skills",
    icon: <GitBranch className="h-5 w-5" />,
    tags: ["Migration", "web3.js", "Kit"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "pinocchio-skill",
    name: "Pinocchio Skill",
    description: "Zero-dependency zero-copy framework for high-performance Solana programs — 88-95% compute unit reduction.",
    category: "skills",
    icon: <Gauge className="h-5 w-5" />,
    tags: ["Pinocchio", "Performance", "Programs"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "vulnhunter-skill",
    name: "VulnHunter Skill",
    description: "Security vulnerability detection, dangerous API hunting, and variant analysis across Solana codebases.",
    category: "security",
    icon: <Shield className="h-5 w-5" />,
    tags: ["Security", "Audit", "Vulnerabilities"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "code-recon-skill",
    name: "Code Recon Skill",
    description: "Deep architectural context building for security audits — mapping trust boundaries and vulnerability analysis.",
    category: "security",
    icon: <Search className="h-5 w-5" />,
    tags: ["Security", "Audit", "Architecture"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
  {
    id: "surfpool-skill",
    name: "Surfpool Skill",
    description: "Solana dev environment with mainnet forking, cheatcodes, and Infrastructure as Code.",
    category: "infra",
    icon: <Cpu className="h-5 w-5" />,
    tags: ["Surfpool", "DevEnv", "Forking"],
    url: "https://github.com/solana-foundation/awesome-solana-ai",
  },
];

const categoryLabels: Record<ToolCategory, string> = {
  all: "All",
  skills: "AI Skills",
  frameworks: "Frameworks",
  security: "Security",
  infra: "Infrastructure",
};

const categoryIcons: Record<ToolCategory, React.ReactNode> = {
  all: <Blocks className="h-3.5 w-3.5" />,
  skills: <Code className="h-3.5 w-3.5" />,
  frameworks: <Bot className="h-3.5 w-3.5" />,
  security: <Shield className="h-3.5 w-3.5" />,
  infra: <Cpu className="h-3.5 w-3.5" />,
};

export function AIToolsAgents() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = tools.filter((t) => {
    const matchCategory = activeCategory === "all" || t.category === activeCategory;
    const matchSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" />
            AI Tools & Agents
            <Badge variant="outline" className="text-xs border-accent/50 text-accent">
              {tools.length} tools
            </Badge>
          </CardTitle>
          <a
            href="https://github.com/solana-foundation/awesome-solana-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
          >
            GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tools, skills, agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs bg-muted/50 border-border/50"
          />
        </div>

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {(Object.keys(categoryLabels) as ToolCategory[]).map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? "default" : "ghost"}
              className={`h-7 text-xs px-2.5 gap-1 ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveCategory(cat)}
            >
              {categoryIcons[cat]}
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
          {filtered.map((tool) => (
            <a
              key={tool.id}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/60 hover:border-accent/40 transition-all duration-200 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 p-1.5 rounded-md bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
                  {tool.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                      {tool.name}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {tool.description}
                  </p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {tool.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 bg-secondary/50 text-secondary-foreground/70"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </a>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tools found matching your search.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
