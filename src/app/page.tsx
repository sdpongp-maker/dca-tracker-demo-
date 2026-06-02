import Dashboard from '@/components/Dashboard';
import { getActiveSymbol, listPositions, listWatchlist, saveMarketSnapshot } from '@/lib/db';
import { buildAiAnalysis, computePortfolioSummary, enrichPositions, summarizeTechnicals } from '@/lib/calc';
import { fallbackQuote, fetchCandles, fetchFundamentals, fetchStockQuote } from '@/lib/stockApi';
import type { WatchlistItem } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ symbol?: string; tf?: string }>;
}) {
  const params = await searchParams;
  const dbSymbol = params?.symbol ? null : await safeDb(() => getActiveSymbol(), 'AMD');
  const activeSymbol = (params?.symbol ?? dbSymbol ?? 'AMD').toUpperCase();
  const timeframe = params?.tf === '1D' || params?.tf === '1W' ? params.tf : '1M';

  const [quoteResult, candles, fundamentals, watchlist, rawPositions] = await Promise.all([
    fetchStockQuote(activeSymbol),
    fetchCandles(activeSymbol, timeframe),
    fetchFundamentals(activeSymbol),
    safeDb(() => listWatchlist(), fallbackWatchlist(activeSymbol)),
    safeDb(() => listPositions(activeSymbol), []),
  ]);

  const quote = quoteResult ?? fallbackQuote(activeSymbol);
  const priceStale = quoteResult === null;
  const positions = enrichPositions(rawPositions, quote.price);
  const summary = computePortfolioSummary(activeSymbol, positions, quote.price);
  const technical = summarizeTechnicals(candles);
  const analysis = buildAiAnalysis(activeSymbol, technical, summary, fundamentals);
  await safeDb(() => saveMarketSnapshot(quote, technical), undefined);

  return (
    <Dashboard
      activeSymbol={activeSymbol}
      quote={quote}
      candles={candles}
      technical={technical}
      analysis={analysis}
      watchlist={watchlist}
      positions={positions}
      summary={summary}
      priceStale={priceStale}
      timeframe={timeframe}
    />
  );
}

async function safeDb<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('SQL Server unavailable:', error);
    return fallback;
  }
}

function fallbackWatchlist(activeSymbol: string): WatchlistItem[] {
  return ['AMD', 'ARM', 'NVDA'].map((symbol, index) => ({
    id: index + 1,
    symbol,
    name: symbol === activeSymbol ? `${symbol} active` : `${symbol} demo`,
    note: 'Connect SQL Server to persist',
    created_at: new Date(0).toISOString(),
  }));
}
