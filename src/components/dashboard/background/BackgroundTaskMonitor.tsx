import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { backgroundTaskService, BackgroundTask } from '@/services/d3mon/BackgroundTaskService';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export function BackgroundTaskMonitor({ walletAddress }: { walletAddress: string | null }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTasks = async () => {
    if (!walletAddress) return;
    try {
      const data = await backgroundTaskService.getTasks(walletAddress);
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch background tasks:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (!walletAddress) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10">Queued</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-accent/20 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="py-4 px-6 border-b border-accent/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            Background Tasks
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={fetchTasks}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto no-scrollbar">
          {tasks.length === 0 ? (
            <div className="py-8 px-4 text-center text-muted-foreground text-xs">
              No recent background tasks.
            </div>
          ) : (
            <div className="divide-y divide-accent/10">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-accent/5 transition-colors">
                  <div className="flex justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                        {task.task_type.replace('_', ' ')}
                        {getStatusBadge(task.status)}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        {new Date(task.created_at).toLocaleString()}
                      </div>
                      
                      {task.status === 'completed' && task.result?.signature && (
                        <a 
                          href={`https://solscan.io/tx/${task.result.signature}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-accent hover:underline flex items-center gap-1 mt-1"
                        >
                          View Signature <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      
                      {task.status === 'failed' && (
                        <div className="text-[10px] text-destructive mt-1 font-mono line-clamp-2">
                          {task.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
