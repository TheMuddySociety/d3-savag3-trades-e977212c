import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ChevronDown, ChevronUp, DollarSign, Clock, TrendingUp, Terminal } from "lucide-react";
import type { AITool } from "./toolsData";

export function ToolCard({ tool }: { tool: AITool }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/60 hover:border-accent/40 transition-all duration-200">
      <div
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
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
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              {expanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {tool.description}
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-[10px] text-accent flex items-center gap-0.5 font-medium">
                <DollarSign className="h-3 w-3" /> {tool.profitRange}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {tool.timeframe}
              </span>
            </div>
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
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30 pt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-background/50 rounded-md p-2">
              <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
                <DollarSign className="h-3 w-3" /> Min Funding
              </span>
              <span className="text-foreground font-medium">{tool.minFunding}</span>
            </div>
            <div className="bg-background/50 rounded-md p-2">
              <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
                <TrendingUp className="h-3 w-3" /> Market
              </span>
              <span className="text-foreground font-medium">{tool.marketCondition}</span>
            </div>
          </div>

          <div className="bg-background/50 rounded-md p-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
              <Terminal className="h-3 w-3" /> Setup Instructions
            </span>
            <ol className="space-y-1">
              {tool.setupSteps.map((step, i) => (
                <li key={i} className="text-[11px] text-foreground/80 flex gap-1.5">
                  <span className="text-accent font-mono shrink-0">{i + 1}.</span>
                  <code className="break-all">{step}</code>
                </li>
              ))}
            </ol>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5 border-accent/30 hover:bg-accent/10 hover:text-accent"
            asChild
          >
            <a href={tool.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> View on GitHub
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
