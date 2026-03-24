import { useRef, useState, useCallback, useEffect } from 'react';
import type { AgentConfig, PortfolioData, EvaluationResult, WorkerPayload } from '../workers/d3s-agent-worker';
import { supabase } from "@/integrations/supabase/client";

export const useD3SAgent = () => {
  const workerRef = useRef<Worker | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<EvaluationResult | null>(null);
  const [peakPrices, setPeakPrices] = useState<Record<string, { price: number; lastUpdated: number }>>({});

  const startAgent = useCallback(() => {
    if (!workerRef.current) {
      // Create worker with proper Vite import
      workerRef.current = new Worker(new URL('../workers/d3s-agent-worker.ts', import.meta.url), { type: 'module' });

      workerRef.current.onmessage = (e: MessageEvent<EvaluationResult>) => {
        const result = e.data;
        setLastResult(result);
        setPeakPrices(result.updatedPeaks);
      };

      workerRef.current.onerror = (err) => {
        console.error('D3S Worker error:', err);
      };
    }
    setIsRunning(true);
  }, []);

  const evaluateFrame = useCallback((payload: WorkerPayload) => {
    if (workerRef.current && isRunning) {
      // Inject the peaks managed by the hook into the worker frame
      workerRef.current.postMessage({
        ...payload,
        currentPeaks: peakPrices,
      });
    }
  }, [isRunning, peakPrices]);

  const stopAgent = useCallback(() => {
    setIsRunning(false);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  // Supabase Realtime Subscription for New Launches
  useEffect(() => {
    const channel = supabase.channel("new-launches");

    channel
      .on("broadcast", { event: "new_launch" }, (payload) => {
        if (workerRef.current && isRunning) {
          workerRef.current.postMessage({
            type: "new_launch",
            payload: payload.payload,
          } as WorkerPayload);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRunning]);

  return { startAgent, stopAgent, evaluateFrame, isRunning, lastResult, peakPrices };
};
