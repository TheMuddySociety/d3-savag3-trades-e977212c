import { supabase } from '@/integrations/supabase/client';

export type TaskType = 'background_trade' | 'background_launch';
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  wallet_address: string;
  task_type: TaskType;
  status: TaskStatus;
  params: Record<string, any>;
  result: Record<string, any> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

class BackgroundTaskService {
  private async invoke(action: string, params: Record<string, any> = {}) {
    const { data, error } = await supabase.functions.invoke('d3mon-background', {
      body: { action, ...params },
    });
    if (error) throw new Error(error.message || 'Background task service error');
    if (!data?.success) throw new Error(data?.error || 'Unknown error');
    return data;
  }

  /**
   * Queue a trade for background execution
   */
  async queueTrade(params: {
    wallet_address: string;
    input_mint: string;
    output_mint: string;
    amount: number;
    slippage_bps?: number;
  }): Promise<BackgroundTask> {
    const data = await this.invoke('queue_trade', params);
    return data.task;
  }

  /**
   * Queue a pre-signed token launch for background execution
   */
  async queueLaunch(params: {
    wallet_address: string;
    token_name: string;
    token_symbol: string;
    description?: string;
    signed_tx: string;
    image_url?: string;
    curve_preset?: string;
  }): Promise<BackgroundTask> {
    const data = await this.invoke('queue_launch', params);
    return data.task;
  }

  /**
   * Get all tasks for a wallet (newest first)
   */
  async getTasks(wallet_address: string, limit: number = 20): Promise<BackgroundTask[]> {
    const data = await this.invoke('get_tasks', { wallet_address, limit });
    return data.tasks;
  }

  /**
   * Get count of pending (queued + processing) tasks
   */
  async getPendingCount(wallet_address: string): Promise<number> {
    const tasks = await this.getTasks(wallet_address);
    return tasks.filter(t => t.status === 'queued' || t.status === 'processing').length;
  }
}

export const backgroundTaskService = new BackgroundTaskService();
