import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash, Search, Download, Image, AlertTriangle, ShieldAlert, Loader2, RefreshCw, ChevronDown, ChevronUp, Skull, Zap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WashTradeFlag {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  description: string;
  evidence: string[];
}

interface SampleNFT {
  id: string;
  name: string;
  image: string | null;
  owner: string;
  burnt: boolean;
}

interface TrackedCollection {
  address: string;
  name: string;
  devWallet: string;
  mintCount: number;
  uniqueOwners: number;
  burntCount: number;
  frozenCount: number;
  salesCount: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  washTradeFlags: WashTradeFlag[];
  transactionCount: number;
  sampleNFTs: SampleNFT[];
  addedAt: string;
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
  rapid_relisting: "Rapid Relisting",
  circular_trading: "Circular Trading",
  price_manipulation: "Price Manipulation",
  bot_minting: "Bot Minting",
  no_royalties: "No Royalties",
  high_burn_rate: "High Burn Rate",
  single_creator: "Unverified Creator",
  fake_volume: "Fake Volume",
};

export function NFTCollectionTracker() {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshingAddress, setRefreshingAddress] = useState<string | null>(null);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);
  const [collections, setCollections] = useState<TrackedCollection[]>(() => {
    const saved = localStorage.getItem("trackedNFTCollections");
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  const persist = (cols: TrackedCollection[]) => {
    setCollections(cols);
    localStorage.setItem("trackedNFTCollections", JSON.stringify(cols));
  };

  const fetchCollectionData = async (collectionAddress: string): Promise<Omit<TrackedCollection, 'addedAt'> | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('nft-tracker', {
        body: { collectionAddress },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch collection data');
      const d = data.data;
      return {
        address: d.collectionAddress,
        name: d.name || `Collection-${collectionAddress.slice(0, 8)}`,
        devWallet: d.devWallet,
        mintCount: d.mintCount,
        uniqueOwners: d.uniqueOwners,
        burntCount: d.burntCount,
        frozenCount: d.frozenCount,
        salesCount: d.salesCount,
        riskLevel: d.riskLevel as TrackedCollection['riskLevel'],
        washTradeFlags: d.washTradeFlags || [],
        transactionCount: d.transactionCount,
        sampleNFTs: d.sampleNFTs || [],
      };
    } catch (err) {
      console.error('NFT tracker fetch error:', err);
      toast.error(`Failed to fetch on-chain data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleAdd = async () => {
    if (!address) { toast.error("Enter a collection address"); return; }
    if (address.length < 32) { toast.error("Invalid Solana address"); return; }
    if (collections.some((c) => c.address === address)) { toast.error("Collection already tracked"); return; }

    setLoading(true);
    toast.info("Scanning NFT collection on-chain via Helius...");
    const result = await fetchCollectionData(address);
    if (result) {
      const col: TrackedCollection = {
        ...result,
        name: name || result.name,
        addedAt: new Date().toISOString(),
      };
      persist([col, ...collections]);
      setAddress("");
      setName("");
      const flagCount = result.washTradeFlags.length;
      toast.success(`Tracking ${col.name} — ${result.mintCount} NFTs, ${flagCount} flags`);
    }
    setLoading(false);
  };

  const handleRefresh = async (addr: string) => {
    setRefreshingAddress(addr);
    const result = await fetchCollectionData(addr);
    if (result) {
      persist(collections.map((c) => c.address === addr ? { ...c, ...result } : c));
      toast.success("Collection data refreshed");
    }
    setRefreshingAddress(null);
  };

  const handleRemove = (addr: string) => {
    persist(collections.filter((c) => c.address !== addr));
    toast.success("Collection removed");
  };

  const filtered = collections.filter(
    (c) => c.address.toLowerCase().includes(searchQuery.toLowerCase()) || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadReport = () => {
    if (collections.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Name", "Address", "Dev Wallet", "Mints", "Owners", "Burnt", "Sales", "Risk", "Flags", "Added"];
    const rows = collections.map((c) => [
      c.name, c.address, c.devWallet, c.mintCount, c.uniqueOwners, c.burntCount, c.salesCount,
      c.riskLevel,
      `"${c.washTradeFlags.map(f => `[${f.severity}] ${f.type}: ${f.description}`).join('; ')}"`,
      new Date(c.addedAt).toLocaleDateString(),
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
  const totalFlags = collections.reduce((s, c) => s + c.washTradeFlags.length, 0);
  const criticalCount = collections.filter((c) => c.riskLevel === "critical").length;
  const totalBurnt = collections.reduce((s, c) => s + c.burntCount, 0);

  return (
    <Card className="border-destructive/20 bg-card">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          NFT Scam Collection Tracker
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary ml-2">LIVE ON-CHAIN</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <Download className="h-4 w-4 mr-2" /> Download Report
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" /> Tracked</p>
            <p className="text-2xl font-bold font-mono text-foreground">{totalCollections}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Flags</p>
            <p className="text-2xl font-bold font-mono text-primary">{totalFlags}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Burnt</p>
            <p className="text-2xl font-bold font-mono text-yellow-400">{totalBurnt}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Critical Risk</p>
            <p className="text-2xl font-bold font-mono text-destructive">{criticalCount}</p>
          </div>
        </div>

        {/* Add */}
        <div className="flex flex-col md:flex-row gap-3">
          <Input placeholder="Collection / creator address" value={address} onChange={(e) => setAddress(e.target.value)} className="flex-1 font-mono text-sm" />
          <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="w-full md:w-40" />
          <Button onClick={handleAdd} disabled={loading} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {loading ? 'Scanning...' : 'Track Collection'}
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
                <th className="text-left p-3 text-muted-foreground">Owners</th>
                <th className="text-left p-3 text-muted-foreground">Burnt</th>
                <th className="text-left p-3 text-muted-foreground">Flags</th>
                <th className="text-left p-3 text-muted-foreground">Risk</th>
                <th className="text-center p-3 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No collections tracked yet — enter a Solana address above to scan on-chain</td></tr>
              ) : (
                filtered.map((col) => {
                  const isExpanded = expandedCol === col.address;
                  const flags = col.washTradeFlags || [];
                  const dangerCount = flags.filter(f => f.severity === 'danger').length;
                  const warnCount = flags.filter(f => f.severity === 'warning').length;

                  return (
                    <>
                      <tr
                        key={col.address}
                        className={`border-t border-border hover:bg-muted/20 cursor-pointer ${isExpanded ? 'bg-muted/10' : ''}`}
                        onClick={() => setExpandedCol(isExpanded ? null : col.address)}
                      >
                        <td className="p-3">
                          <div className="font-medium text-foreground">{col.name}</div>
                          <div className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">{col.address}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Dev: {col.devWallet.slice(0, 6)}...{col.devWallet.slice(-4)} · {col.transactionCount} txns
                          </div>
                        </td>
                        <td className="p-3 font-mono">{col.mintCount.toLocaleString()}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono">{col.uniqueOwners}</span>
                          </div>
                          {col.mintCount > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {Math.round(col.uniqueOwners / col.mintCount * 100)}% unique
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-destructive">{col.burntCount}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {dangerCount > 0 && <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-[10px]">{dangerCount} danger</Badge>}
                            {warnCount > 0 && <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-800/40 text-[10px]">{warnCount} warn</Badge>}
                            {flags.length === 0 && <span className="text-muted-foreground text-xs">Clean</span>}
                            {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-1" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={`${RISK_COLORS[col.riskLevel]} text-xs uppercase`}>{col.riskLevel}</Badge>
                        </td>
                        <td className="p-3 text-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => handleRefresh(col.address)} disabled={refreshingAddress === col.address} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                            <RefreshCw className={`h-4 w-4 ${refreshingAddress === col.address ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemove(col.address)} className="h-7 w-7 p-0 text-destructive hover:text-destructive/80">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded flags */}
                      {isExpanded && (
                        <tr key={`${col.address}-details`}>
                          <td colSpan={7} className="p-0">
                            <div className="bg-muted/5 border-t border-border px-4 py-3 space-y-4">
                              {/* Sample NFTs */}
                              {col.sampleNFTs.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Sample NFTs</p>
                                  <div className="flex gap-2 overflow-x-auto pb-2">
                                    {col.sampleNFTs.map((nft) => (
                                      <div key={nft.id} className="shrink-0 w-24 border border-border rounded-lg p-2 bg-background/50">
                                        {nft.image ? (
                                          <img src={nft.image} alt={nft.name} className="w-full h-16 object-cover rounded mb-1" loading="lazy" />
                                        ) : (
                                          <div className="w-full h-16 bg-muted rounded mb-1 flex items-center justify-center">
                                            <Image className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <p className="text-[10px] text-foreground truncate">{nft.name}</p>
                                        {nft.burnt && <Badge className="bg-destructive/20 text-destructive text-[9px] mt-0.5">Burnt</Badge>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Wash trade flags */}
                              {flags.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">No wash trading patterns detected</p>
                              ) : (
                                <>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Wash Trade Analysis — {flags.length} flags</p>
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
