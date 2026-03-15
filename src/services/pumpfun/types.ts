// Official Pump.Fun API response types (frontend-api-v3)
export interface PumpFunCoin {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  twitter: string | null;
  telegram: string | null;
  bonding_curve: string;
  associated_bonding_curve: string;
  creator: string;
  created_timestamp: number;
  raydium_pool: string | null;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  total_supply: number;
  website: string | null;
  show_name: boolean;
  king_of_the_hill_timestamp: number | null;
  market_cap: number;
  reply_count: number;
  last_reply: number | null;
  nsfw: boolean;
  market_id: string | null;
  inverted: boolean | null;
  usd_market_cap: number;
  username: string | null;
  profile_image: string | null;
  is_currently_live: boolean;
}

// Legacy BullMe proxy types (kept for backward compat)
export interface PumpFunToken {
  address: string;
  symbol: string;
  name: string;
  totalSupply: number;
  decimals: number;
  logo: string;
  creator: string;
  description: string;
  showName: boolean;
  twitter: string;
  telegram: string;
  website: string;
  blockNumber: number;
  hash: string;
  source: string;
  dex: string | null;
  timestamp: number;
  migrateTime: number | null;
  completeTime: number | null;
  marketCap: number;
  tradeVolume: number;
  tradeCount: number;
  top10Holder: number;
  bondingCurveProgress: number;
  status: string;
  tradeVolume24h: number;
  buyVolume24h: number;
  sellVolume24h: number;
  tradeCount24h: number;
  buyCount24h: number;
  sellCount24h: number;
  liquidity: number;
}

export interface PumpFunApiResponse {
  code: number;
  msg: string;
  ts: number;
  data: PumpFunToken[];
}
