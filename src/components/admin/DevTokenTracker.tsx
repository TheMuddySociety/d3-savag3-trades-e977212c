import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash, Search, Download, AlertTriangle, Skull, TrendingDown, Loader2, RefreshCw, ChevronDown, ChevronUp, ShieldAlert, Zap, Copy, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DevTimeline } from "./DevTimeline";

interface PatternFlag {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  description: string;
  evidence: string[];
}

interface TrackedDev {
  walletAddress: string;
  alias: string;
  tokensLaunched: number;
  rugPulls: number;
  honeypots: number;
  avgLifespan: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  addedAt: string;
  notes: string;
  tokens?: { mint: string; name: string; symbol: string; supply: number; burnt: boolean }[];
  transactionCount?: number;
  suspiciousPatterns?: number;
  patternFlags?: PatternFlag[];
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-900/30 text-green-400 border-green-800",
  medium: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
  high: "bg-orange-900/30 text-orange-400 border-orange-800",
  critical: "bg-destructive/20 text-destructive border-destructive/40",
};

const FLAG_SEVERITY_STYLES: Record<string, { bg: string; icon: string; border: string }> = {
  danger: { bg: "bg-destructive/10", icon: "text-destructive", border: "border-destructive/30" },
  warning: { bg: "bg-yellow-900/10", icon: "text-yellow-400", border: "border-yellow-800/30" },
  info: { bg: "bg-blue-900/10", icon: "text-blue-400", border: "border-blue-800/30" },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  symbol_reuse: "Symbol Reuse",
  name_similarity: "Name Templates",
  supply_clone: "Supply Clone",
  rapid_launch: "Rapid Launch",
  burst_trading: "Burst Trading",
  serial_deployer: "Serial Deployer",
  instant_dump: "Instant Dump",
  identical_decimals_supply: "Identical Config",
};

export function DevTokenTracker() {
  const [devAddress, setDevAddress] = useState("");
  const [devAlias, setDevAlias] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshingAddress, setRefreshingAddress] = useState<string | null>(null);
  const [expandedDev, setExpandedDev] = useState<string | null>(null);
  const [trackedDevs, setTrackedDevs] = useState<TrackedDev[]>(() => {
    const saved = localStorage.getItem("trackedDevs");
    return saved ? JSON.parse(saved) : [];
  });

  const persist = (devs: TrackedDev[]) => {
    setTrackedDevs(devs);
    localStorage.setItem("trackedDevs", JSON.stringify(devs));
  };

  const fetchDevData = async (walletAddress: string): Promise<Omit<TrackedDev, 'alias' | 'addedAt' | 'notes'> | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('dev-tracker', {
        body: { walletAddress },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch dev data');
      const d = data.data;
      return {
        walletAddress: d.walletAddress,
        tokensLaunched: d.tokensLaunched,
        rugPulls: d.rugPulls,
        honeypots: d.honeypots,
        avgLifespan: d.avgLifespan,
        riskLevel: d.riskLevel as TrackedDev['riskLevel'],
        tokens: d.tokens,
        transactionCount: d.transactionCount,
        suspiciousPatterns: d.suspiciousPatterns,
        patternFlags: d.patternFlags || [],
      };
    } catch (err) {
      console.error('Dev tracker fetch error:', err);
      toast.error(`Failed to fetch on-chain data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleAddDev = async () => {
    if (!devAddress) { toast.error("Enter a developer wallet address"); return; }
    if (devAddress.length < 32) { toast.error("Invalid Solana wallet address"); return; }
    if (trackedDevs.some((d) => d.walletAddress === devAddress)) { toast.error("Developer already tracked"); return; }

    setLoading(true);
    toast.info("Scanning on-chain patterns via Helius...");
    const result = await fetchDevData(devAddress);
    if (result) {
      const newDev: TrackedDev = {
        ...result,
        alias: devAlias || `Dev-${devAddress.slice(0, 6)}`,
        addedAt: new Date().toISOString(),
        notes: "",
      };
      persist([newDev, ...trackedDevs]);
      setDevAddress("");
      setDevAlias("");
      const flagCount = result.patternFlags?.length || 0;
      toast.success(`Tracking ${newDev.alias} — ${result.tokensLaunched} tokens, ${flagCount} pattern flags`);
    }
    setLoading(false);
  };

  const handleRefresh = async (address: string) => {
    setRefreshingAddress(address);
    const result = await fetchDevData(address);
    if (result) {
      persist(trackedDevs.map((d) => d.walletAddress === address ? { ...d, ...result } : d));
      toast.success("Dev data refreshed");
    }
    setRefreshingAddress(null);
  };

  const handleRemove = (address: string) => {
    persist(trackedDevs.filter((d) => d.walletAddress !== address));
    toast.success("Developer removed");
  };

  const filteredDevs = trackedDevs.filter(
    (d) => d.walletAddress.toLowerCase().includes(searchQuery.toLowerCase()) || d.alias.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadReport = () => {
    if (trackedDevs.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Alias", "Wallet", "Tokens", "Rugs", "Honeypots", "Patterns", "Flags", "Risk", "TX Count", "Added"];
    const rows = trackedDevs.map((d) => [
      d.alias, d.walletAddress, d.tokensLaunched, d.rugPulls, d.honeypots,
      d.suspiciousPatterns ?? 0,
      `"${(d.patternFlags || []).map((f) => `[${f.severity}] ${f.type}: ${f.description}`).join('; ')}"`,
      d.riskLevel, d.transactionCount ?? 0, new Date(d.addedAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dev-scam-tracker-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const totalDevs = trackedDevs.length;
  const totalRugs = trackedDevs.reduce((s, d) => s + d.rugPulls, 0);
  const totalHoneypots = trackedDevs.reduce((s, d) => s + d.honeypots, 0);
  const totalFlags = trackedDevs.reduce((s, d) => s + (d.patternFlags?.length || 0), 0);
  const criticalDevs = trackedDevs.filter((d) => d.riskLevel === "critical").length;

  return (
    <Card className="border-destructive/20 bg-card">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Skull className="h-5 w-5 text-destructive" />
          Dev Token Scam Tracker
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary ml-2">LIVE ON-CHAIN</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <Download className="h-4 w-4 mr-2" /> Download Report
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Tracked Devs</p>
            <p className="text-2xl font-bold font-mono text-foreground">{totalDevs}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Rug Pulls</p>
            <p className="text-2xl font-bold font-mono text-destructive">{totalRugs}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Honeypots</p>
            <p className="text-2xl font-bold font-mono text-yellow-400">{totalHoneypots}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Pattern Flags</p>
            <p className="text-2xl font-bold font-mono text-primary">{totalFlags}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Critical Risk</p>
            <p className="text-2xl font-bold font-mono text-destructive">{criticalDevs}</p>
          </div>
        </div>

        {/* Add Dev */}
        <div className="flex flex-col md:flex-row gap-3">
          <Input placeholder="Developer wallet address" value={devAddress} onChange={(e) => setDevAddress(e.target.value)} className="flex-1 font-mono text-sm" />
          <Input placeholder="Alias (optional)" value={devAlias} onChange={(e) => setDevAlias(e.target.value)} className="w-full md:w-40" />
          <Button onClick={handleAddDev} disabled={loading} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {loading ? 'Scanning...' : 'Track Dev'}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by wallet or alias..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Table */}
        <div className="border rounded-md overflow-x-auto border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 text-muted-foreground">Dev</th>
                <th className="text-left p-3 text-muted-foreground">Tokens</th>
                <th className="text-left p-3 text-muted-foreground">Rugs</th>
                <th className="text-left p-3 text-muted-foreground">Honeypots</th>
                <th className="text-left p-3 text-muted-foreground">Flags</th>
                <th className="text-left p-3 text-muted-foreground">Risk</th>
                <th className="text-center p-3 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevs.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No developers tracked yet — enter a Solana wallet above to scan on-chain</td></tr>
              ) : (
                filteredDevs.map((dev) => {
                  const isExpanded = expandedDev === dev.walletAddress;
                  const flags = dev.patternFlags || [];
                  const dangerCount = flags.filter((f) => f.severity === 'danger').length;
                  const warnCount = flags.filter((f) => f.severity === 'warning').length;

                  return (
                    <>
                      <tr
                        key={dev.walletAddress}
                        className={`border-t border-border hover:bg-muted/20 cursor-pointer ${isExpanded ? 'bg-muted/10' : ''}`}
                        onClick={() => setExpandedDev(isExpanded ? null : dev.walletAddress)}
                      >
                        <td className="p-3">
                          <div className="font-medium text-foreground">{dev.alias}</div>
                          <div className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">{dev.walletAddress}</div>
                          {dev.transactionCount !== undefined && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{dev.transactionCount} txns · {dev.avgLifespan} avg</div>
                          )}
                        </td>
                        <td className="p-3 font-mono">{dev.tokensLaunched}</td>
                        <td className="p-3 font-mono text-destructive">{dev.rugPulls}</td>
                        <td className="p-3 font-mono text-yellow-400">{dev.honeypots}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {dangerCount > 0 && <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-[10px]">{dangerCount} danger</Badge>}
                            {warnCount > 0 && <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-800/40 text-[10px]">{warnCount} warn</Badge>}
                            {flags.length === 0 && <span className="text-muted-foreground text-xs">Clean</span>}
                            {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-1" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={`${RISK_COLORS[dev.riskLevel]} text-xs uppercase`}>{dev.riskLevel}</Badge>
                        </td>
                        <td className="p-3 text-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleRefresh(dev.walletAddress)} disabled={refreshingAddress === dev.walletAddress} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                            <RefreshCw className={`h-4 w-4 ${refreshingAddress === dev.walletAddress ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemove(dev.walletAddress)} className="h-7 w-7 p-0 text-destructive hover:text-destructive/80">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded Pattern Flags */}
                      {isExpanded && (
                        <tr key={`${dev.walletAddress}-flags`}>
                          <td colSpan={7} className="p-0">
                            <div className="bg-muted/5 border-t border-border px-4 py-3 space-y-4">
                              {/* Timeline Chart */}
                              {dev.tokens && dev.tokens.length > 0 && (
                                <div className="border border-border rounded-lg p-4 bg-background/50">
                                  <DevTimeline
                                    tokens={dev.tokens.map((t) => ({ ...t, createdAt: (t as any).createdAt ?? null }))}
                                    patternFlags={flags}
                                    walletAddress={dev.walletAddress}
                                  />
                                </div>
                              )}

                              {flags.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">No suspicious patterns detected for this developer</p>
                              ) : (
                                <>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pattern Analysis — {flags.length} flags detected</p>
                                  <div className="grid gap-2">
                                    {flags.map((flag, i) => {
                                      const styles = FLAG_SEVERITY_STYLES[flag.severity] || FLAG_SEVERITY_STYLES.info;
                                      return (
                                        <div key={i} className={`${styles.bg} border ${styles.border} rounded-lg p-3`}>
                                          <div className="flex items-start gap-2">
                                            {flag.severity === 'danger' ? (
                                              <Skull className={`h-4 w-4 mt-0.5 shrink-0 ${styles.icon}`} />
                                            ) : flag.severity === 'warning' ? (
                                              <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${styles.icon}`} />
                                            ) : (
                                              <Zap className={`h-4 w-4 mt-0.5 shrink-0 ${styles.icon}`} />
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={`text-[10px] ${styles.border} ${styles.icon}`}>
                                                  {FLAG_TYPE_LABELS[flag.type] || flag.type}
                                                </Badge>
                                                <Badge variant="outline" className={`text-[10px] uppercase ${styles.border} ${styles.icon}`}>
                                                  {flag.severity}
                                                </Badge>
                                              </div>
                                              <p className="text-sm text-foreground">{flag.description}</p>
                                              {flag.evidence.length > 0 && (
                                                <ul className="mt-1.5 space-y-0.5">
                                                  {flag.evidence.map((e, j) => (
                                                    <li key={j} className="text-xs text-muted-foreground font-mono flex items-start gap-1.5">
                                                      <span className="text-muted-foreground/50 select-none">›</span>
                                                      {e}
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
