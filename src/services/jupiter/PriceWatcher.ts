/**
 * PriceWatcher — Interval-based price monitoring with threshold evaluation
 *
 * Based on the QuickNode Jupiter bot pattern: watches price at intervals,
 * evaluates quotes against configurable thresholds, and triggers callbacks
 * when conditions are met.
 *
 * Used by DCA bot, Auto strategies, and background trading.
 */

import { JupiterV6Service, QuoteResponse } from './v6';
import { JupiterUltraService } from './ultra';

// ─── Types ──────────────────────────────────────────────────────────

export interface PriceWatchConfig {
  inputMint: string;
  outputMint: string;
  amount: string;                   // In smallest unit (lamports)
  slippageBps?: number;
  checkIntervalMs?: number;         // Default: 5000 (5s)
  targetGainPercentage?: number;    // Default: 1% — executes when quote beats threshold by this %
  baselinePrice?: number;           // Initial price to measure against (outAmount per unit)
}

export interface PriceWatchCallbacks {
  onQuote?: (quote: QuoteResponse, currentPrice: number) => void;
  onThresholdMet?: (quote: QuoteResponse, gainPct: number) => void;
  onSwapExecuted?: (result: { signature: string; quote: QuoteResponse }) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: PriceWatchStatus) => void;
}

export type PriceWatchStatus = 'idle' | 'watching' | 'executing' | 'paused' | 'stopped';

// ─── PriceWatcher ───────────────────────────────────────────────────

export class PriceWatcher {
  private config: Required<PriceWatchConfig>;
  private callbacks: PriceWatchCallbacks;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private status: PriceWatchStatus = 'idle';
  private waitingForConfirmation = false;
  private v6: JupiterV6Service;
  private lastCheck = 0;
  private quoteHistory: { timestamp: number; outAmount: string; price: number }[] = [];

  constructor(config: PriceWatchConfig, callbacks: PriceWatchCallbacks = {}) {
    this.config = {
      ...config,
      slippageBps: config.slippageBps ?? 300,
      checkIntervalMs: config.checkIntervalMs ?? 5000,
      targetGainPercentage: config.targetGainPercentage ?? 1.0,
      baselinePrice: config.baselinePrice ?? 0,
    };
    this.callbacks = callbacks;
    this.v6 = new JupiterV6Service();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Start watching prices at the configured interval
   */
  start(): void {
    if (this.status === 'watching') return;

    console.log('[PriceWatcher] Starting price watch:', {
      pair: `${this.config.inputMint.slice(0, 6)}→${this.config.outputMint.slice(0, 6)}`,
      interval: `${this.config.checkIntervalMs}ms`,
      targetGain: `${this.config.targetGainPercentage}%`,
    });

    this.setStatus('watching');
    this.checkPrice(); // Immediate first check

    this.intervalId = setInterval(() => {
      this.checkPrice();
    }, this.config.checkIntervalMs);
  }

  /**
   * Pause watching (can be resumed)
   */
  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.setStatus('paused');
    console.log('[PriceWatcher] Paused');
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this.status !== 'paused') return;
    this.start();
  }

  /**
   * Stop completely and clean up
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.setStatus('stopped');
    this.waitingForConfirmation = false;
    console.log('[PriceWatcher] Stopped');
  }

  getStatus(): PriceWatchStatus {
    return this.status;
  }

  getQuoteHistory() {
    return [...this.quoteHistory];
  }

  /**
   * Update the target gain percentage on the fly
   */
  updateTargetGain(pct: number): void {
    this.config.targetGainPercentage = pct;
    console.log(`[PriceWatcher] Target gain updated to ${pct}%`);
  }

  /**
   * Update the baseline price (threshold to beat)
   */
  updateBaseline(price: number): void {
    this.config.baselinePrice = price;
    console.log(`[PriceWatcher] Baseline updated to ${price}`);
  }

  // ── Core Logic ────────────────────────────────────────────────────

  private async checkPrice(): Promise<void> {
    if (this.waitingForConfirmation) {
      console.log('[PriceWatcher] Waiting for previous tx...');
      return;
    }

    const now = Date.now();
    if (now - this.lastCheck < this.config.checkIntervalMs * 0.8) return; // Debounce
    this.lastCheck = now;

    try {
      // Try V6 first, fall back to Ultra quote-only
      let quote: QuoteResponse;

      if (JupiterV6Service.isV6Available()) {
        quote = await this.v6.getQuote({
          inputMint: this.config.inputMint,
          outputMint: this.config.outputMint,
          amount: this.config.amount,
          slippageBps: this.config.slippageBps,
        });
      } else {
        // Use Jupiter price API as fallback for quote
        const res = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${this.config.inputMint}&outputMint=${this.config.outputMint}&amount=${this.config.amount}&slippageBps=${this.config.slippageBps}`
        );
        if (!res.ok) throw new Error(`Quote failed: ${res.status}`);
        quote = await res.json();
      }

      const currentPrice = parseInt(quote.outAmount);

      // Track history (keep last 100)
      this.quoteHistory.push({ timestamp: now, outAmount: quote.outAmount, price: currentPrice });
      if (this.quoteHistory.length > 100) this.quoteHistory.shift();

      // Emit quote callback
      this.callbacks.onQuote?.(quote, currentPrice);

      // Evaluate against threshold
      if (this.config.baselinePrice > 0) {
        this.evaluateQuote(quote, currentPrice);
      } else {
        // First quote sets the baseline
        this.config.baselinePrice = currentPrice;
        console.log(`[PriceWatcher] Baseline set: ${currentPrice}`);
      }
    } catch (error) {
      console.error('[PriceWatcher] Check error:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private evaluateQuote(quote: QuoteResponse, currentPrice: number): void {
    const threshold = this.config.baselinePrice;
    const difference = (currentPrice - threshold) / threshold;
    const gainPct = difference * 100;

    console.log(
      `[PriceWatcher] Price: ${currentPrice} vs threshold: ${threshold} ` +
      `(${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%, target: +${this.config.targetGainPercentage}%)`
    );

    if (gainPct >= this.config.targetGainPercentage) {
      console.log(`[PriceWatcher] 🎯 Threshold met! Gain: ${gainPct.toFixed(2)}%`);
      this.callbacks.onThresholdMet?.(quote, gainPct);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private setStatus(status: PriceWatchStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  /**
   * Execute a swap (called externally after threshold is met)
   * Uses V6 if available, otherwise Ultra.
   */
  async executeSwap(
    wallet: any,
    quote?: QuoteResponse,
  ): Promise<{ signature: string; quote: QuoteResponse } | null> {
    this.waitingForConfirmation = true;
    this.setStatus('executing');

    try {
      if (JupiterV6Service.isV6Available()) {
        const result = await this.v6.buildAndSendSwap(wallet, {
          inputMint: this.config.inputMint,
          outputMint: this.config.outputMint,
          amount: this.config.amount,
          slippageBps: this.config.slippageBps,
        });
        if (result) {
          this.callbacks.onSwapExecuted?.(result);
          // Update baseline for next trade cycle
          this.config.baselinePrice = parseInt(result.quote.outAmount);
        }
        return result;
      } else {
        // Ultra fallback
        const result = await JupiterUltraService.swap(
          wallet,
          this.config.inputMint,
          this.config.outputMint,
          this.config.amount,
        );
        if (result?.status === 'Success' && result.signature) {
          const swapResult = {
            signature: result.signature,
            quote: quote || ({} as QuoteResponse),
          };
          this.callbacks.onSwapExecuted?.(swapResult);
          return swapResult;
        }
        return null;
      }
    } catch (error) {
      console.error('[PriceWatcher] Swap error:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      return null;
    } finally {
      this.waitingForConfirmation = false;
      if (this.status === 'executing') this.setStatus('watching');
    }
  }
}
