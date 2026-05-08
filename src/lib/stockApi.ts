import type { Candle, FundamentalSnapshot, StockQuote, Timeframe } from '@/types';
import { enrichCandles } from './calc';
import { getApiCallCountToday, logApiCall } from './db';

const STOOQ_DAILY = 'https://stooq.com/q/d/l/?i=d&s=';
const STOOQ_QUOTE = 'https://stooq.com/q/l/?f=sd2t2ohlcvn&e=csv&s=';
const ALPHA_URL = 'https://www.alphavantage.co/query';
const TWELVE_URL = 'https://api.twelvedata.com';
const FMP_URL = 'https://financialmodelingprep.com/stable';

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  return await fetchTwelveQuote(symbol) ?? await fetchStooqQuote(symbol);
}

export async function fetchCandles(symbol: string, timeframe: Timeframe = '1M'): Promise<Candle[]> {
  const twelve = await fetchTwelveCandles(symbol, timeframe);
  if (twelve.length > 0) return twelve;
  const fmp = await fetchFmpCandles(symbol, timeframe);
  if (fmp.length > 0) return fmp;
  const stooq = await fetchStooqCandles(symbol, timeframe);
  if (stooq.length > 0) return stooq;
  return [];
}

export async function fetchFundamentals(symbol: string): Promise<FundamentalSnapshot | null> {
  if (!process.env.FMP_API_KEY || !isUsMarketWindowBangkok()) return null;
  if (!await canCallProvider('fmp', 250, 4)) return null;
  const [profile, metrics, rating, target] = await Promise.all([
    fetchFmpArray<FmpProfile>('profile', symbol),
    fetchFmpArray<FmpKeyMetrics>('key-metrics-ttm', symbol),
    fetchFmpArray<FmpRating>('ratings-snapshot', symbol),
    fetchFmpArray<FmpPriceTarget>('price-target-summary', symbol),
  ]);
  const p = profile[0];
  if (!p) return null;
  const m = metrics[0];
  const r = rating[0];
  const t = target[0];
  return {
    symbol: p.symbol || symbol.toUpperCase(),
    companyName: p.companyName || symbol.toUpperCase(),
    sector: p.sector || '',
    industry: p.industry || '',
    marketCap: Number(p.marketCap ?? 0),
    beta: Number(p.beta ?? 0),
    priceTarget: finiteOrNull(t?.lastMonthAvgPriceTarget ?? t?.lastQuarterAvgPriceTarget ?? t?.lastYearAvgPriceTarget),
    analystCount: Number(t?.lastMonthCount ?? t?.lastQuarterCount ?? t?.lastYearCount ?? 0),
    rating: r?.rating || 'N/A',
    ratingScore: Number(r?.overallScore ?? 0),
    peScore: Number(r?.priceToEarningsScore ?? 0),
    roe: finiteOrNull(m?.returnOnEquityTTM),
    roa: finiteOrNull(m?.returnOnAssetsTTM),
    roic: finiteOrNull(m?.returnOnInvestedCapitalTTM),
    currentRatio: finiteOrNull(m?.currentRatioTTM),
    netDebtToEbitda: finiteOrNull(m?.netDebtToEBITDATTM),
    fcfYield: finiteOrNull(m?.freeCashFlowYieldTTM),
    evToSales: finiteOrNull(m?.evToSalesTTM),
    evToFcf: finiteOrNull(m?.evToFreeCashFlowTTM),
    source: 'FMP fundamentals',
    asOf: new Date().toISOString(),
  };
}

async function fetchFmpCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey || !isUsMarketWindowBangkok()) return [];
  if (!await canCallProvider('fmp', 250, 1)) return [];
  const url = new URL(`${FMP_URL}/historical-price-eod/full`);
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('apikey', apiKey);
  try {
    const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) });
    const json = await res.json() as FmpHistoricalRow[];
    await logApiCall('fmp', 'historical-price-eod/full', symbol, res.ok && Array.isArray(json) ? 'ok' : 'error');
    if (!res.ok || !Array.isArray(json)) return [];
    const candles = json.slice(0, 180)
      .map((row): Candle => ({
        date: row.date,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume ?? 0),
      }))
      .filter((row) => Number.isFinite(row.close))
      .sort((a, b) => a.date.localeCompare(b.date));
    return trimForTimeframe(enrichCandles(candles), timeframe);
  } catch {
    await logApiCall('fmp', 'historical-price-eod/full', symbol, 'error');
    return [];
  }
}

async function fetchTwelveQuote(symbol: string): Promise<StockQuote | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey || !isUsMarketWindowBangkok()) return null;
  if (!await canCallProvider('twelvedata', 800, 1)) return null;
  const url = new URL(`${TWELVE_URL}/quote`);
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('apikey', apiKey);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const json = await res.json() as TwelveQuoteResponse;
    await logApiCall('twelvedata', 'quote', symbol, res.ok && !json.status ? 'ok' : json.status ?? 'ok');
    const close = Number(json.close);
    if (!res.ok || !Number.isFinite(close) || close <= 0) return null;
    const previousClose = Number(json.previous_close);
    const change = Number(json.change);
    return {
      symbol: json.symbol || symbol.toUpperCase(),
      name: json.name || symbol.toUpperCase(),
      price: close,
      change: Number.isFinite(change) ? change : close - previousClose,
      changePct: Number(json.percent_change) || 0,
      previousClose,
      currency: json.currency || 'USD',
      exchange: json.exchange || 'US',
      asOf: json.datetime || new Date().toISOString(),
      source: 'Twelve Data quote',
    };
  } catch {
    await logApiCall('twelvedata', 'quote', symbol, 'error');
    return null;
  }
}

async function fetchTwelveCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey || !isUsMarketWindowBangkok()) return [];
  if (!await canCallProvider('twelvedata', 800, 1)) return [];
  const url = new URL(`${TWELVE_URL}/time_series`);
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('interval', '1day');
  url.searchParams.set('outputsize', '180');
  url.searchParams.set('apikey', apiKey);
  try {
    const res = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    const json = await res.json() as TwelveTimeSeriesResponse;
    await logApiCall('twelvedata', 'time_series', symbol, res.ok && json.status === 'ok' ? 'ok' : json.status ?? 'error');
    if (!res.ok || json.status !== 'ok' || !json.values) return [];
    const candles = json.values
      .map((row): Candle => ({
        date: row.datetime.slice(0, 10),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume ?? 0),
      }))
      .filter((row) => Number.isFinite(row.close))
      .sort((a, b) => a.date.localeCompare(b.date));
    return trimForTimeframe(enrichCandles(candles), timeframe);
  } catch {
    await logApiCall('twelvedata', 'time_series', symbol, 'error');
    return [];
  }
}

async function fetchAlphaQuote(symbol: string): Promise<StockQuote | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;
  const url = new URL(ALPHA_URL);
  url.searchParams.set('function', 'GLOBAL_QUOTE');
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('apikey', apiKey);
  if (process.env.ALPHA_VANTAGE_ENTITLEMENT) {
    url.searchParams.set('entitlement', process.env.ALPHA_VANTAGE_ENTITLEMENT);
  }
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json() as AlphaQuoteResponse;
    const row = json['Global Quote'];
    const price = Number(row?.['05. price']);
    if (!row || !Number.isFinite(price) || price <= 0) return null;
    const previousClose = Number(row['08. previous close']);
    const change = Number(row['09. change']);
    return {
      symbol: row['01. symbol'] || symbol.toUpperCase(),
      name: row['01. symbol'] || symbol.toUpperCase(),
      price,
      change: Number.isFinite(change) ? change : price - previousClose,
      changePct: parsePercent(row['10. change percent']),
      previousClose,
      currency: 'USD',
      exchange: 'US',
      asOf: row['07. latest trading day'] || new Date().toISOString(),
      source: 'Alpha Vantage quote',
    };
  } catch {
    return null;
  }
}

async function fetchAlphaCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];
  const url = new URL(ALPHA_URL);
  url.searchParams.set('function', 'TIME_SERIES_DAILY');
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('outputsize', 'compact');
  url.searchParams.set('apikey', apiKey);
  try {
    const res = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json() as AlphaDailyResponse;
    const series = json['Time Series (Daily)'];
    if (!series) return [];
    const all = Object.entries(series)
      .map(([date, row]): Candle => ({
        date,
        open: Number(row['1. open']),
        high: Number(row['2. high']),
        low: Number(row['3. low']),
        close: Number(row['4. close']),
        volume: Number(row['5. volume']),
      }))
      .filter((row) => Number.isFinite(row.close))
      .sort((a, b) => a.date.localeCompare(b.date));
    return trimForTimeframe(enrichCandles(all), timeframe);
  } catch {
    return [];
  }
}

async function fetchStooqQuote(symbol: string): Promise<StockQuote | null> {
  if (!isUsMarketWindowBangkok()) return null;
  const normalized = toStooqSymbol(symbol);
  try {
    const res = await fetch(`${STOOQ_QUOTE}${normalized}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const rows = parseCsv(text);
    const row = rows.length > 1 && rows[0]?.[0]?.toLowerCase() === 'symbol' ? rows[1] : rows[0];
    if (!row || row[6] === 'N/D') return null;
    const open = Number(row[3]);
    const high = Number(row[4]);
    const low = Number(row[5]);
    const close = Number(row[6]);
    const previousClose = Number.isFinite(open) && open > 0 ? open : close;
    const change = close - previousClose;
    return {
      symbol: symbol.toUpperCase(),
      name: row[8] || symbol.toUpperCase(),
      price: close,
      change,
      changePct: previousClose > 0 ? (change / previousClose) * 100 : 0,
      previousClose,
      currency: 'USD',
      exchange: 'US',
      asOf: `${row[1]}T${row[2]}`,
      source: 'Stooq delayed public quote',
    };
  } catch {
    return null;
  }
}

async function fetchStooqCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  if (!isUsMarketWindowBangkok()) return [];
  const normalized = toStooqSymbol(symbol);
  try {
    const res = await fetch(`${STOOQ_DAILY}${normalized}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const rows = parseCsv(await res.text()).slice(1);
    const all = rows
      .map((row): Candle | null => {
        const [date, open, high, low, close, volume] = row;
        if (!date || !open || !high || !low || !close) return null;
        return {
          date,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume ?? 0),
        };
      })
      .filter((row): row is Candle => row !== null && Number.isFinite(row.close));
    if (all.length === 0) return [];
    return trimForTimeframe(enrichCandles(all), timeframe);
  } catch {
    return [];
  }
}

export function fallbackQuote(symbol: string): StockQuote {
  const candles = fallbackCandles(symbol, '1M');
  const latest = candles.at(-1)!;
  const prev = candles.at(-2) ?? latest;
  const change = latest.close - prev.close;
  return {
    symbol: symbol.toUpperCase(),
    name: `${symbol.toUpperCase()} demo quote`,
    price: latest.close,
    change,
    changePct: prev.close > 0 ? (change / prev.close) * 100 : 0,
    previousClose: prev.close,
    currency: 'USD',
    exchange: 'US',
    asOf: latest.date,
    source: 'Local fallback',
  };
}

function fallbackCandles(symbol: string, timeframe: Timeframe): Candle[] {
  const seed = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = 120 + (seed % 180);
  const rows: Candle[] = [];
  const today = new Date();
  for (let i = 119; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const wave = Math.sin((120 - i) / 7) * 6 + Math.cos((120 - i) / 17) * 10;
    const drift = (120 - i) * 0.18;
    const close = Math.max(8, base + wave + drift);
    const open = close * (1 + Math.sin(i) * 0.006);
    const high = Math.max(open, close) * 1.015;
    const low = Math.min(open, close) * 0.985;
    rows.push({
      date: date.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: 4_000_000 + (seed % 17) * 250_000,
    });
  }
  return trimForTimeframe(enrichCandles(rows), timeframe);
}

function trimForTimeframe(candles: Candle[], timeframe: Timeframe): Candle[] {
  const sizes: Record<Timeframe, number> = { '1D': 2, '1W': 7, '1M': 30 };
  return candles.slice(-sizes[timeframe]);
}

function toStooqSymbol(symbol: string): string {
  const normalized = symbol.trim().toLowerCase();
  return normalized.includes('.') ? normalized : `${normalized}.us`;
}

async function fetchFmpArray<T>(endpoint: string, symbol: string): Promise<T[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];
  const url = new URL(`${FMP_URL}/${endpoint}`);
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('apikey', apiKey);
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) });
    const json = await res.json();
    await logApiCall('fmp', endpoint, symbol, res.ok && Array.isArray(json) ? 'ok' : 'error');
    return res.ok && Array.isArray(json) ? json as T[] : [];
  } catch {
    await logApiCall('fmp', endpoint, symbol, 'error');
    return [];
  }
}

async function canCallProvider(provider: string, limit: number, cost: number): Promise<boolean> {
  const used = await getApiCallCountToday(provider);
  return used + cost <= limit;
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        cells.push(cell);
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell);
    return cells.map((value) => value.trim());
  });
}

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUsMarketWindowBangkok(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const total = hour * 60 + minute;
  const open = 20 * 60 + 30;
  const close = 4 * 60;
  return total >= open || total <= close;
}

type AlphaQuoteResponse = {
  'Global Quote'?: {
    '01. symbol': string;
    '05. price': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
};

type AlphaDailyResponse = {
  'Time Series (Daily)'?: Record<string, {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  }>;
};

type TwelveQuoteResponse = {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  status?: string;
};

type TwelveTimeSeriesResponse = {
  status?: string;
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
};

type FmpHistoricalRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type FmpProfile = {
  symbol?: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  beta?: number;
};

type FmpKeyMetrics = {
  returnOnEquityTTM?: number;
  returnOnAssetsTTM?: number;
  returnOnInvestedCapitalTTM?: number;
  currentRatioTTM?: number;
  netDebtToEBITDATTM?: number;
  freeCashFlowYieldTTM?: number;
  evToSalesTTM?: number;
  evToFreeCashFlowTTM?: number;
};

type FmpRating = {
  rating?: string;
  overallScore?: number;
  priceToEarningsScore?: number;
};

type FmpPriceTarget = {
  lastMonthCount?: number;
  lastMonthAvgPriceTarget?: number;
  lastQuarterCount?: number;
  lastQuarterAvgPriceTarget?: number;
  lastYearCount?: number;
  lastYearAvgPriceTarget?: number;
};
