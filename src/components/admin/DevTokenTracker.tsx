import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash, Search, Download, AlertTriangle, Skull, TrendingDown } from "lucide-react";

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
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-900/30 text-green-400 border-green-800",
  medium: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
  high: "bg-orange-900/30 text-orange-400 border-orange-800",
  critical: "bg-destructive/20 text-destructive border-destructive/40",
};

export function DevTokenTracker() {
  const [devAddress, setDevAddress] = useState("");
  const [devAlias, setDevAlias] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [trackedDevs, setTrackedDevs] = useState<TrackedDev[]>(() => {
    const saved = localStorage.getItem("trackedDevs");
    return saved ? JSON.parse(saved) : [];
  });

  const persist = (devs: TrackedDev[]) => {
    setTrackedDevs(devs);
    localStorage.setItem("trackedDevs", JSON.stringify(devs));
  };

  const handleAddDev = () => {
    if (!devAddress) {
      toast.error("Enter a developer wallet address");
      return;
    }
    if (trackedDevs.some((d) => d.walletAddress === devAddress)) {
      toast.error("Developer already tracked");
      return;
    }

    // Simulated data — in production you'd pull from on-chain analysis
    const riskOptions: TrackedDev["riskLevel"][] = ["low", "medium", "high", "critical"];
    const randomRisk = riskOptions[Math.floor(Math.random() * riskOptions.length)];
    const randomTokens = Math.floor(Math.random() * 50) + 1;
    const randomRugs = Math.floor(Math.random() * Math.min(randomTokens, 15));
    const randomHoneypots = Math.floor(Math.random() * Math.min(randomTokens - randomRugs, 10));

    const newDev: TrackedDev = {
      walletAddress: devAddress,
      alias: devAlias || `Dev-${devAddress.slice(0, 6)}`,
      tokensLaunched: randomTokens,
      rugPulls: randomRugs,
      honeypots: randomHoneypots,
      avgLifespan: `${Math.floor(Math.random() * 72) + 1}h`,
      riskLevel: randomRisk,
      addedAt: new Date().toISOString(),
      notes: "",
    };

    persist([newDev, ...trackedDevs]);
    setDevAddress("");
    setDevAlias("");
    toast.success(`Now tracking ${newDev.alias}`);
  };

  const handleRemove = (address: string) => {
    persist(trackedDevs.filter((d) => d.walletAddress !== address));
    toast.success("Developer removed from tracker");
  };

  const filteredDevs = trackedDevs.filter(
    (d) =>
      d.walletAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.alias.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadReport = () => {
    if (trackedDevs.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Alias", "Wallet", "Tokens Launched", "Rug Pulls", "Honeypots", "Avg Lifespan", "Risk Level", "Added"];
    const rows = trackedDevs.map((d) => [
      d.alias, d.walletAddress, d.tokensLaunched, d.rugPulls, d.honeypots, d.avgLifespan, d.riskLevel, new Date(d.addedAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dev-token-tracker-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  // Summary stats
  const totalDevs = trackedDevs.length;
  const totalRugs = trackedDevs.reduce((s, d) => s + d.rugPulls, 0);
  const totalHoneypots = trackedDevs.reduce((s, d) => s + d.honeypots, 0);
  const criticalDevs = trackedDevs.filter((d) => d.riskLevel === "critical").length;

  return (
    <Card className="border-destructive/20 bg-card">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Skull className="h-5 w-5 text-destructive" />
          Dev Token Scam Tracker
        </CardTitle>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <p className="text-xs text-muted-foreground">Critical Risk</p>
            <p className="text-2xl font-bold font-mono text-destructive">{criticalDevs}</p>
          </div>
        </div>

        {/* Add Dev */}
        <div className="flex flex-col md:flex-row gap-3">
          <Input placeholder="Developer wallet address" value={devAddress} onChange={(e) => setDevAddress(e.target.value)} className="flex-1 font-mono text-sm" />
          <Input placeholder="Alias (optional)" value={devAlias} onChange={(e) => setDevAlias(e.target.value)} className="w-full md:w-40" />
          <Button onClick={handleAddDev} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">
            <Plus className="h-4 w-4 mr-2" /> Track Dev
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
                <th className="text-left p-3 text-muted-foreground">Avg Life</th>
                <th className="text-left p-3 text-muted-foreground">Risk</th>
                <th className="text-center p-3 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevs.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No developers tracked yet</td></tr>
              ) : (
                filteredDevs.map((dev) => (
                  <tr key={dev.walletAddress} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium text-foreground">{dev.alias}</div>
                      <div className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">{dev.walletAddress}</div>
                    </td>
                    <td className="p-3 font-mono">{dev.tokensLaunched}</td>
                    <td className="p-3 font-mono text-destructive">{dev.rugPulls}</td>
                    <td className="p-3 font-mono text-yellow-400">{dev.honeypots}</td>
                    <td className="p-3 font-mono">{dev.avgLifespan}</td>
                    <td className="p-3">
                      <Badge className={`${RISK_COLORS[dev.riskLevel]} text-xs uppercase`}>{dev.riskLevel}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(dev.walletAddress)} className="h-7 w-7 p-0 text-destructive hover:text-destructive/80">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
