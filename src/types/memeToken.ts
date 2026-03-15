
export interface MemeToken {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change1h?: number;
  change5m?: number;
  logoUrl: string;
  tokenAddress?: string;
  liquidity: number;
  holders: number;
  age?: string;
  onChainHolders?: number;
  onChainLiquidity?: number;
  tags: string[];
  timestamp: number;
  status?: string;
  bondingCurveProgress?: number;
}
