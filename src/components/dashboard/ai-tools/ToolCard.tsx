import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { AITool } from "./toolsData";

interface ToolCardProps {
  tool: AITool;
  onClick?: () => void;
}

export function ToolCard({ tool, onClick }: ToolCardProps) {
  const isClickable = !!onClick && tool.status === "active";

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
      className={`group rounded-xl border border-border/40 bg-card/50 transition-all duration-200 p-4 flex flex-col gap-3 ${
        isClickable
          ? "cursor-pointer hover:bg-accent/10 hover:border-accent/50 hover:shadow-[0_0_20px_rgba(var(--accent),0.1)] active:scale-[0.98]"
          : "hover:bg-card/80 hover:border-border/60"
      }`}
    >
      {/* Icon + Status */}
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-accent/15 to-primary/10 text-accent group-hover:from-accent/25 group-hover:to-primary/20 transition-colors">
          {tool.icon}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 h-4 ${
              tool.status === "active"
                ? "bg-accent/10 text-accent border-accent/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {tool.status === "active" ? "● Active" : "Coming Soon"}
          </Badge>
          {isClickable && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-accent transition-all group-hover:translate-x-0.5" />
          )}
        </div>
      </div>

      {/* Title + Description */}
      <div>
        <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
          {tool.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap mt-auto">
        {tool.tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-[9px] px-1.5 py-0 h-4 bg-secondary/40 text-secondary-foreground/70"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
