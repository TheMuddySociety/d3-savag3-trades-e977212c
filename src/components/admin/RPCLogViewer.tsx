import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Clock, AlertCircle, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RPCLog {
  id: string;
  rpc_method: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
  error_message: string | null;
}

export function RPCLogViewer() {
  const [logs, setLogs] = useState<RPCLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rpc_request_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to fetch RPC logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // --- Data Processing for Charts ---
  
  const metrics = useMemo(() => {
    if (logs.length === 0) return { total: 0, avgLatency: 0, errorRate: 0 };
    const errors = logs.filter(l => l.status_code >= 400).length;
    const totalLatency = logs.reduce((sum, l) => sum + (l.latency_ms || 0), 0);
    return {
      total: logs.length,
      avgLatency: Math.round(totalLatency / logs.length),
      errorRate: ((errors / logs.length) * 100).toFixed(1)
    };
  }, [logs]);

  const methodData = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => {
      counts[l.rpc_method] = (counts[l.rpc_method] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [logs]);

  const latencyTrendData = useMemo(() => {
    // Group by minute for the last hour
    const trend = logs.slice(0, 50).reverse().map(l => ({
      time: format(new Date(l.created_at), 'HH:mm:ss'),
      latency: l.latency_ms
    }));
    return trend;
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Requests (500)</p>
              <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Latency</p>
              <p className="text-2xl font-bold text-foreground">{metrics.avgLatency}ms</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className={cn("h-8 w-8", Number(metrics.errorRate) > 5 ? "text-destructive" : "text-green-500")} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Error Rate</p>
              <p className="text-2xl font-bold text-foreground">{metrics.errorRate}%</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Method Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodData} layout="vertical" margin={{ left: 40, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#888" fontSize={10} />
                <YAxis type="category" dataKey="name" stroke="#888" fontSize={10} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                  itemStyle={{ color: '#ef4444' }}
                />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Latency over Time (ms)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyTrendData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="time" stroke="#888" fontSize={9} />
                <YAxis stroke="#888" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                />
                <Area type="monotone" dataKey="latency" stroke="#ef4444" fillOpacity={1} fill="url(#colorLatency)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs Table */}
      <Card className="border-border/40 bg-card/30">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden border-border/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="text-left p-3">Method</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Latency</th>
                  <th className="text-left p-3">Time</th>
                  <th className="text-left p-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono font-medium text-accent">{log.rpc_method}</td>
                    <td className="p-3">
                      <Badge variant={log.status_code >= 400 ? "destructive" : "outline"} className="text-[9px] h-5">
                        {log.status_code}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{log.latency_ms}ms</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(log.created_at), 'HH:mm:ss')}</td>
                    <td className="p-3 max-w-[200px] truncate text-destructive/80 italic">
                      {log.error_message || "-"}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">No logs found in the last batch.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
