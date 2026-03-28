import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ShieldAlert, ShieldCheck, ShieldX, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ShieldResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  recommendation: string;
  riskFactors: string[];
  safeFactors: string[];
  isOnStrictList: boolean;
  holders: number;
  top10HolderPct: number;
  liquidity: number;
  lpBurned: boolean;
  flags: {
    mintAuthority: boolean;
    freezeAuthority: boolean;
    lowLiquidity: boolean;
    lowHolders: boolean;
    jupiterWarning: boolean;
    shieldWarnings: string[];
  };
}

interface TokenSafetyCardProps {
  tokenAddress: string;
  tokenName?: string;
  compact?: boolean;
  top10RiskPercent?: number;
  isHighRisk?: boolean;
}

const RISK_CONFIG = {
  LOW: {
    icon: ShieldCheck,
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/30',
    label: 'LOW RISK',
    barColor: 'bg-accent',
  },
  MEDIUM: {
    icon: ShieldAlert,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'MEDIUM RISK',
    barColor: 'bg-yellow-500',
  },
  HIGH: {
    icon: ShieldX,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    label: 'HIGH RISK',
    barColor: 'bg-destructive',
  },
};

export function TokenSafetyCard({ tokenAddress, tokenName, compact = false, top10RiskPercent, isHighRisk }: TokenSafetyCardProps) {
  const [result, setResult] = useState<ShieldResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('token-prices', {
        body: { action: 'shield_check', address: tokenAddress },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Check failed');
      setResult(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shield check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenAddress) runCheck();
  }, [tokenAddress]);

  if (loading) {
    return (
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            Safety check unavailable
          </div>
          <Button variant="outline" size="sm" onClick={runCheck} className="h-7 text-xs">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const config = RISK_CONFIG[result.riskLevel] || RISK_CONFIG.MEDIUM;
  const RiskIcon = config.icon || ShieldAlert;

  if (compact) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', config.color, config.border)}>
        <RiskIcon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  return (
    <Card className={cn('border', config.border, config.bg)}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiskIcon className={cn('h-5 w-5', config.color)} />
            <div>
              <span className={cn('font-bold text-sm', config.color)}>{config.label}</span>
              <span className="text-xs text-muted-foreground ml-2">Score: {result.riskScore}/100</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 p-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Risk bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', config.barColor)}
            style={{ width: `${Math.min(100, result.riskScore)}%` }}
          />
        </div>

        {/* Recommendation */}
        <p className="text-xs text-muted-foreground">{result.recommendation}</p>

        {/* Dynamic Risk Warning from Edge Function */}
        {isHighRisk && top10RiskPercent && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-destructive flex-1">
              <strong>High Concentration Risk:</strong> {top10RiskPercent}% of supply is held by unverified top holders (excluding known liquidity pools). Rug pull risk elevated.
            </div>
          </div>
        )}

        {/* Quick flags */}
        <div className="flex flex-wrap gap-1.5">
          <FlagBadge ok={!result.flags.mintAuthority} label="Mint" />
          <FlagBadge ok={!result.flags.freezeAuthority} label="Freeze" />
          <FlagBadge ok={result.lpBurned} label="LP Burned" />
          <FlagBadge ok={result.isOnStrictList} label="Verified" />
          <FlagBadge ok={result.top10HolderPct <= 20} label={`Top10: ${result.top10HolderPct}%`} />
          <FlagBadge ok={!result.flags.lowLiquidity} label="Liquidity" />
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {result.safeFactors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-accent mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Positive Signals
                </h4>
                <ul className="space-y-1">
                  {result.safeFactors.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">•</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.riskFactors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-destructive mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Risk Factors
                </h4>
                <ul className="space-y-1">
                  {result.riskFactors.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-destructive mt-0.5">⚠</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SAVAG3BOT summary table */}
            <div className="rounded-md border border-border/50 overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium">Check</th>
                    <th className="text-center p-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  <CheckRow label="Mint Authority Revoked" ok={!result.flags.mintAuthority} />
                  <CheckRow label="Freeze Authority Revoked" ok={!result.flags.freezeAuthority} />
                  <CheckRow label="LP Burned / Locked" ok={result.lpBurned} />
                  <CheckRow label="Jupiter Strict List" ok={result.isOnStrictList} />
                  <CheckRow label="Top 10 Holders ≤ 20%" ok={result.top10HolderPct <= 20} />
                  <CheckRow label="Liquidity ≥ $5K" ok={!result.flags.lowLiquidity} />
                  <CheckRow label="50+ Holders" ok={!result.flags.lowHolders} />
                  <CheckRow label="No Jupiter Warnings" ok={!result.flags.jupiterWarning} />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlagBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
      ok
        ? 'bg-accent/10 text-accent border-accent/30'
        : 'bg-destructive/10 text-destructive border-destructive/30'
    )}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <tr>
      <td className="p-2 text-muted-foreground">{label}</td>
      <td className={cn('p-2 text-center font-medium', ok ? 'text-accent' : 'text-destructive')}>
        {ok ? '✅ PASS' : '❌ FAIL'}
      </td>
    </tr>
  );
}
