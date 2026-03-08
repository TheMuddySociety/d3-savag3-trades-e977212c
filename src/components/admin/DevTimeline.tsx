import { useMemo } from "react";
import { Skull, Rocket, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TokenEvent {
  mint: string;
  name: string;
  symbol: string;
  supply: number;
  burnt: boolean;
  createdAt?: number | null;
}

interface PatternFlag {
  type: string;
  severity: "info" | "warning" | "danger";
  description: string;
  evidence: string[];
}

interface DevTimelineProps {
  tokens: TokenEvent[];
  patternFlags: PatternFlag[];
  walletAddress: string;
}

export function DevTimeline({ tokens, patternFlags, walletAddress }: DevTimelineProps) {
  const events = useMemo(() => {
    const items: {
      timestamp: number;
      type: "launch" | "dump" | "flag";
      label: string;
      sublabel: string;
      severity?: "info" | "warning" | "danger";
    }[] = [];

    for (const t of tokens) {
      if (!t.createdAt) continue;
      items.push({
        timestamp: t.createdAt,
        type: "launch",
        label: t.symbol || t.name,
        sublabel: `Supply: ${t.supply.toLocaleString()}`,
      });
      if (t.burnt) {
        // Dump event slightly after launch
        items.push({
          timestamp: t.createdAt + 300,
          type: "dump",
          label: `${t.symbol} dumped`,
          sublabel: "Token burnt / rug pulled",
          severity: "danger",
        });
      }
    }

    // Add pattern flag events at midpoint of timeline
    const timestamps = items.map((i) => i.timestamp).filter(Boolean);
    if (timestamps.length > 0 && patternFlags.length > 0) {
      const mid = Math.floor((Math.min(...timestamps) + Math.max(...timestamps)) / 2);
      for (const flag of patternFlags.filter((f) => f.severity === "danger")) {
        items.push({
          timestamp: mid,
          type: "flag",
          label: flag.type.replace(/_/g, " "),
          sublabel: flag.description.slice(0, 60),
          severity: flag.severity,
        });
      }
    }

    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [tokens, patternFlags]);

  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No timeline data available — tokens missing creation timestamps
      </div>
    );
  }

  const minTs = events[0].timestamp;
  const maxTs = events[events.length - 1].timestamp;
  const range = maxTs - minTs || 1;

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  // Group events that are very close together
  const EVENT_STYLES = {
    launch: {
      dot: "bg-primary border-primary/60",
      line: "bg-primary/30",
      icon: Rocket,
      iconClass: "text-primary",
    },
    dump: {
      dot: "bg-destructive border-destructive/60",
      line: "bg-destructive/30",
      icon: Skull,
      iconClass: "text-destructive",
    },
    flag: {
      dot: "bg-yellow-500 border-yellow-600",
      line: "bg-yellow-500/30",
      icon: AlertTriangle,
      iconClass: "text-yellow-400",
    },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Token Launch Timeline — {events.length} events
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Launch
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Dump
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Flag
          </span>
        </div>
      </div>

      {/* Horizontal timeline bar */}
      <div className="relative">
        <div className="h-1 bg-border rounded-full w-full" />

        {/* Time markers */}
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
          <span>{formatDate(minTs)}</span>
          {range > 86400 && <span>{formatDate(minTs + range / 2)}</span>}
          <span>{formatDate(maxTs)}</span>
        </div>

        {/* Event dots on the bar */}
        {events.map((event, i) => {
          const pos = ((event.timestamp - minTs) / range) * 100;
          const styles = EVENT_STYLES[event.type];
          return (
            <div
              key={i}
              className="absolute top-0 -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${Math.min(Math.max(pos, 2), 98)}%` }}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 ${styles.dot} cursor-pointer transition-transform hover:scale-150 relative z-10`}
              />
              {/* Tooltip */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 min-w-[140px]">
                <div className="bg-popover border border-border rounded-md shadow-lg px-2.5 py-1.5 text-xs">
                  <div className="font-medium text-foreground flex items-center gap-1">
                    <styles.icon className={`h-3 w-3 ${styles.iconClass}`} />
                    {event.label}
                  </div>
                  <div className="text-muted-foreground text-[10px]">{event.sublabel}</div>
                  <div className="text-muted-foreground/70 text-[10px] font-mono mt-0.5">
                    {formatDate(event.timestamp)} {formatTime(event.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vertical event list */}
      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
        {events.map((event, i) => {
          const styles = EVENT_STYLES[event.type];
          const IconComponent = styles.icon;
          return (
            <div key={i} className="flex items-start gap-2 text-xs group">
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-2 h-2 rounded-full ${styles.dot} shrink-0`} />
                {i < events.length - 1 && <div className={`w-px flex-1 min-h-[16px] ${styles.line}`} />}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-1.5">
                  <IconComponent className={`h-3 w-3 shrink-0 ${styles.iconClass}`} />
                  <span className="font-medium text-foreground truncate">{event.label}</span>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                    event.type === "dump" ? "border-destructive/40 text-destructive" :
                    event.type === "flag" ? "border-yellow-800/40 text-yellow-400" :
                    "border-primary/40 text-primary"
                  }`}>
                    {event.type}
                  </Badge>
                </div>
                <div className="text-muted-foreground font-mono text-[10px]">
                  {formatDate(event.timestamp)} {formatTime(event.timestamp)} — {event.sublabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
