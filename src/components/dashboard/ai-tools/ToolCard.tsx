import { Badge } from "@/components/ui/badge";
import type { AITool } from "./toolsData";

export function ToolCard({ tool }: { tool: AITool }) {
  return (
    <div className="group rounded-xl border border-border/40 bg-card/50 hover:bg-card/80 hover:border-accent/40 transition-all duration-200 p-4 flex flex-col gap-3">
      {/* Icon + Status */}
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-accent/15 to-primary/10 text-accent group-hover:from-accent/25 group-hover:to-primary/20 transition-colors">
          {tool.icon}
        </div>
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
