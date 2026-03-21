import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Search } from "lucide-react";
import { tools, categoryLabels, categoryIcons, type ToolCategory } from "./ai-tools/toolsData";
import { ToolCard } from "./ai-tools/ToolCard";

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

  const handleToolClick = useCallback((tabKey: string) => {
    // Dispatch custom event — BotAccess listens for this
    window.dispatchEvent(
      new CustomEvent("navigate-bot-tab", { detail: { tab: tabKey } })
    );
    // Scroll to the Bot Trading Tools section
    const botSection = document.querySelector("[data-bot-tools]");
    if (botSection) {
      botSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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
        </div>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
          {filtered.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onClick={tool.tabKey ? () => handleToolClick(tool.tabKey!) : undefined}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm col-span-2">
              No tools found matching your search.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

