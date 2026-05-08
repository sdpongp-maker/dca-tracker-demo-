export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  previousClose: number;
  currency: string;
  exchange: string;
  asOf: string;
  source: string;
};

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20?: number | null;
  ma50?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
};

export type Timeframe = '1D' | '1W' | '1M';

export type ForecastPoint = {
  horizon: '1M' | '3M' | '6M';
  price: number;
  changePct: number;
  confidence: number;
};

export type WatchlistItem = {
  id: number;
  symbol: string;
  name: string;
  note: string;
  created_at: string;
  quote?: StockQuote | null;
};

export type Position = {
  id: number;
  symbol: string;
  date: string;
  shares: number;
  price: number;
  fees: number;
  created_at: string;
};

export type EnrichedPosition = Position & {
  lotNumber: number;
  invested: number;
  cumShares: number;
  cumInvested: number;
  averageCost: number;
  marketValue: number;
  unrealized: number;
  pctUnrealized: number;
};

export type PortfolioSummary = {
  symbol: string;
  totalInvested: number;
  totalShares: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealized: number;
  pctProfitLoss: number;
  maxDrawdown: number;
  worstLotLossPct: number;
  worstLotLossUsd: number;
  worstLotDate: string;
  bestLotGainPct: number;
  bestLotDate: string;
  targetPrice: number;
  targetUpsidePct: number;
};

export type TechnicalSnapshot = {
  trend: 'bullish' | 'bearish' | 'neutral';
  rsiLabel: string;
  macdLabel: string;
  maLabel: string;
  support: number;
  resistance: number;
  forecast: ForecastPoint[];
  latest?: Candle;
};

export type FundamentalSnapshot = {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  beta: number;
  priceTarget: number | null;
  analystCount: number;
  rating: string;
  ratingScore: number;
  peScore: number;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  currentRatio: number | null;
  netDebtToEbitda: number | null;
  fcfYield: number | null;
  evToSales: number | null;
  evToFcf: number | null;
  source: string;
  asOf: string;
};

export type AiAnalysis = {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  totalScore: number;
  technicalScore: number;
  fundamentalScore: number;
  valuationScore: number;
  analystScore: number;
  summary: string;
  reasons: string[];
  risk: string;
  swingSetup: string;
  generatedAt: string;
  fundamentals?: FundamentalSnapshot | null;
};

export type DashboardData = {
  activeSymbol: string;
  quote: StockQuote | null;
  candles: Candle[];
  technical: TechnicalSnapshot | null;
  watchlist: WatchlistItem[];
  positions: EnrichedPosition[];
  summary: PortfolioSummary | null;
  priceStale: boolean;
};

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; fallbackPrice?: number | null };
export type ApiResult<T> = ApiOk<T> | ApiErr;
