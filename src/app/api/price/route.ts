import { NextResponse } from 'next/server';
import { fallbackQuote, fetchStockQuote } from '@/lib/stockApi';
import { normalizeSymbol } from '@/lib/db';
import type { ApiResult, StockQuote } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse<ApiResult<StockQuote>>> {
  const url = new URL(req.url);
  const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? 'AMD');
  const quote = await fetchStockQuote(symbol);
  if (quote) return NextResponse.json({ ok: true, data: quote });
  return NextResponse.json({ ok: false, error: 'quote_unavailable', fallbackPrice: fallbackQuote(symbol).price });
}
