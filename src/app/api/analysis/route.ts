import { NextResponse } from 'next/server';
import { buildAiAnalysis, summarizeTechnicals } from '@/lib/calc';
import { normalizeSymbol } from '@/lib/db';
import { fetchCandles, fetchFundamentals, fetchStockQuote } from '@/lib/stockApi';
import type { AiAnalysis, ApiResult, Timeframe } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse<ApiResult<AiAnalysis>>> {
  const url = new URL(req.url);
  const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? 'AMD');
  const tf = url.searchParams.get('tf');
  const timeframe: Timeframe = tf === '1D' || tf === '1W' || tf === '1M' ? tf : '1M';
  const [candles, fundamentals, quote] = await Promise.all([
    fetchCandles(symbol, timeframe),
    fetchFundamentals(symbol),
    fetchStockQuote(symbol),
  ]);
  const technical = summarizeTechnicals(candles);
  return NextResponse.json({ ok: true, data: buildAiAnalysis(symbol, technical, null, fundamentals ?? (quote ? {
    symbol,
    companyName: symbol,
    sector: '',
    industry: '',
    marketCap: 0,
    beta: 0,
    priceTarget: null,
    analystCount: 0,
    rating: 'N/A',
    ratingScore: 0,
    peScore: 0,
    roe: null,
    roa: null,
    roic: null,
    currentRatio: null,
    netDebtToEbitda: null,
    fcfYield: null,
    evToSales: null,
    evToFcf: null,
    source: quote.source,
    asOf: quote.asOf,
  } : null)) });
}
