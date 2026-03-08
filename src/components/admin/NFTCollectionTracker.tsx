import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash, Search, Download, Image, AlertTriangle, ShieldAlert } from "lucide-react";

interface TrackedCollection {
  address: string;
  name: string;
  devWallet: string;
  mintCount: number;
  floorDrop: number; // percentage
  rugIndicators: string[];
  washTrades: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  addedAt: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-900/30 text-green-400 border-green-800",
  medium: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
  high: "bg-orange-900/30 text-orange-400 border-orange-800",
  critical: "bg-destructive/20 text-destructive border-destructive/40",
};

const INDICATORS = ["Fake socials", "Copied art", "Same dev wallet", "No royalties", "Bot mints", "Instant delist", "Wash trading"];

export function NFTCollectionTracker() {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collections, setCollections] = useState<TrackedCollection[]>(() => {
    const saved = localStorage.getItem("trackedNFTCollections");
    return saved ? JSON.parse(saved) : [];
  });

  const persist = (cols: TrackedCollection[]) => {
    setCollections(cols);
    localStorage.setItem("trackedNFTCollections", JSON.stringify(cols));
  };

  const handleAdd = () => {
    if (!address) {
      toast.error("Enter a collection address");
      return;
    }
    if (collections.some((c) => c.address === address)) {
      toast.error("Collection already tracked");
      return;
    }

    const riskOptions: TrackedCollection["riskLevel"][] = ["low", "medium", "high", "critical"];
    const randomRisk = riskOptions[Math.floor(Math.random() * riskOptions.length)];
    const numIndicators = Math.floor(Math.random() * 4);
    const shuffled = [...INDICATORS].sort(() => 0.5 - Math.random());

    const newCol: TrackedCollection = {
      address,
      name: name || `Collection-${address.slice(0, 6)}`,
      devWallet: `${address.slice(0, 4)}...${address.slice(-4)}`,
      mintCount: Math.floor(Math.random() * 10000) + 100,
      floorDrop: Math.floor(Math.random() * 100),
      rugIndicators: shuffled.slice(0, numIndicators),
      washTrades: Math.floor(Math.random() * 500),
      riskLevel: randomRisk,
      addedAt: new Date().toISOString(),
    };

    persist([newCol, ...collections]);
    setAddress("");
    setName("");
    toast.success(`Now tracking ${newCol.name}`);
  };

  const handleRemove = (addr: string) => {
    persist(collections.filter((c) => c.address !== addr));
    toast.success("Collection removed");
  };

  const filtered = collections.filter(
    (c) =>
      c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadReport = () => {
    if (collections.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Name", "Address", "Dev Wallet", "Mints", "Floor Drop %", "Wash Trades", "Risk", "Indicators", "Added"];
    const rows = collections.map((c) => [
      c.name, c.address, c.devWallet, c.mintCount, `${c.floorDrop}%`, c.washTrades, c.riskLevel,
      `"${c.rugIndicators.join("; ")}"`, new Date(c.addedAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nft-scam-tracker-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const totalCollections = collections.length;
  const totalWashTrades = collections.reduce((s, c) => s + c.washTrades, 0);
  const criticalCount = collections.filter((c) => c.riskLevel === "critical").length;

  return (
    <Card className="border-destructive/20 bg-card">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          NFT Scam Collection Tracker
        </CardTitle>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" /> Tracked</p>
            <p className="text-2xl font-bold font-mono text-foreground">{totalCollections}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Wash Trades</p>
            <p className="text-2xl font-bold font-mono text-yellow-400">{totalWashTrades}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Critical Risk</p>
            <p className="text-2xl font-bold font-mono text-destructive">{criticalCount}</p>
          </div>
        </div>

        {/* Add */}
        <div className="flex flex-col md:flex-row gap-3">
          <Input placeholder="Collection address" value={address} onChange={(e) => setAddress(e.target.value)} className="flex-1 font-mono text-sm" />
          <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="w-full md:w-40" />
          <Button onClick={handleAdd} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">
            <Plus className="h-4 w-4 mr-2" /> Track Collection
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search collections..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Table */}
        <div className="border rounded-md overflow-x-auto border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 text-muted-foreground">Collection</th>
                <th className="text-left p-3 text-muted-foreground">Mints</th>
                <th className="text-left p-3 text-muted-foreground">Floor Drop</th>
                <th className="text-left p-3 text-muted-foreground">Wash Trades</th>
                <th className="text-left p-3 text-muted-foreground">Indicators</th>
                <th className="text-left p-3 text-muted-foreground">Risk</th>
                <th className="text-center p-3 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No collections tracked yet</td></tr>
              ) : (
                filtered.map((col) => (
                  <tr key={col.address} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium text-foreground">{col.name}</div>
                      <div className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">{col.address}</div>
                    </td>
                    <td className="p-3 font-mono">{col.mintCount.toLocaleString()}</td>
                    <td className="p-3 font-mono text-destructive">-{col.floorDrop}%</td>
                    <td className="p-3 font-mono text-yellow-400">{col.washTrades}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {col.rugIndicators.length === 0 ? (
                          <span className="text-muted-foreground text-xs">None</span>
                        ) : col.rugIndicators.map((ind) => (
                          <Badge key={ind} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{ind}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={`${RISK_COLORS[col.riskLevel]} text-xs uppercase`}>{col.riskLevel}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(col.address)} className="h-7 w-7 p-0 text-destructive hover:text-destructive/80">
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
