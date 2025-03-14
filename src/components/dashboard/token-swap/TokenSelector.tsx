
import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface TokenSelectorProps {
  label: string;
  tokens: any[];
  selectedToken: string;
  onTokenChange: (token: string) => void;
  amount?: number;
  onAmountChange?: (amount: number) => void;
  readonly?: boolean;
  value?: string | number;
}

export function TokenSelector({ 
  label, 
  tokens, 
  selectedToken, 
  onTokenChange, 
  amount, 
  onAmountChange, 
  readonly = false,
  value
}: TokenSelectorProps) {
  const tokenDetails = tokens.find(t => t.mint === selectedToken);

  return (
    <div className="space-y-2">
      <Label htmlFor={`token-${label}`}>{label}</Label>
      <div className="flex space-x-2">
        <select
          id={`token-${label}`}
          value={selectedToken}
          onChange={(e) => onTokenChange(e.target.value)}
          className="w-1/3 h-10 px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-solana"
        >
          {tokens.map((token) => (
            <option key={`${label}-${token.mint}`} value={token.mint}>
              {token.symbol}
            </option>
          ))}
        </select>
        {readonly ? (
          <Input
            type="text"
            value={value || "0"}
            readOnly
            className="w-2/3 bg-background/30"
          />
        ) : (
          <Input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange && onAmountChange(Number(e.target.value))}
            min={0.000001}
            placeholder="Amount"
            className="w-2/3"
          />
        )}
      </div>
      {tokenDetails && (
        <div className="flex items-center text-sm text-muted-foreground">
          <img 
            src={tokenDetails.logoURI} 
            alt={tokenDetails.symbol}
            className="w-4 h-4 mr-1 rounded-full"
          />
          {tokenDetails.name}
        </div>
      )}
    </div>
  );
}
