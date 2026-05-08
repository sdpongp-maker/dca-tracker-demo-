'use client';

import { useRouter } from 'next/navigation';
import { fmtPct, fmtUsd } from './_fmt';
import type { AiAnalysis, StockQuote, TechnicalSnapshot, WatchlistItem } from '@/types';

type Props = {
  activeSymbol: string;
  watchlist: WatchlistItem[];
  quote: StockQuote;
  technical: TechnicalSnapshot | null;
  analysis?: AiAnalysis;
};

export default function Goals({ activeSymbol, watchlist, quote, technical, analysis }: Props) {
  const router = useRouter();

  async function select(symbol: string) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_symbol: symbol }),
    });
    router.push(`/?symbol=${encodeURIComponent(symbol)}`);
    router.refresh();
  }

  async function addCurrent() {
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: activeSymbol, name: quote.name, note: 'Watching' }),
    });
    router.refresh();
  }

  return (
    <div className="goals stock-panel">
      <div className="goal-card watchlist-card">
        <div className="goal-top">
          <h3>Watchlist</h3>
          <button className="btn" onClick={addCurrent}>Add {activeSymbol}</button>
        </div>
        <div className="watchlist-list">
          {watchlist.map((item) => (
            <button
              key={item.id}
              className={'watch-row' + (item.symbol === activeSymbol ? ' active' : '')}
              onClick={() => select(item.symbol)}
            >
              <span>
                <strong>{item.symbol}</strong>
                <small>{item.name || item.note || 'US stock'}</small>
              </span>
              <span className="mono">View</span>
            </button>
          ))}
        </div>
      </div>

      <div className="goal-card ai-card">
        <div className="goal-top">
          <h3>Technical Snapshot</h3>
          <div className="pct">{technical?.trend ?? 'neutral'}</div>
        </div>
        <div className="ai-lines">
          <div><span>MA</span><strong>{technical?.maLabel ?? 'Waiting for data'}</strong></div>
          <div><span>RSI</span><strong>{technical?.latest?.rsi14?.toFixed(1) ?? '—'} · {technical?.rsiLabel ?? '—'}</strong></div>
          <div><span>MACD</span><strong>{technical?.macdLabel ?? '—'}</strong></div>
          <div><span>Range</span><strong>${fmtUsd(technical?.support ?? quote.price)} / ${fmtUsd(technical?.resistance ?? quote.price)}</strong></div>
          <div><span>Today</span><strong>{quote.change >= 0 ? '+' : ''}${fmtUsd(quote.change)} · {fmtPct(quote.changePct)}</strong></div>
          <div><span>Target</span><strong>{analysis?.fundamentals?.priceTarget ? `$${fmtUsd(analysis.fundamentals.priceTarget)} · ${analysis.fundamentals.analystCount} analysts` : 'n/a'}</strong></div>
          <div><span>Quality</span><strong>{analysis?.fundamentals ? `${analysis.fundamentals.rating} · ROE ${analysis.fundamentals.roe === null ? 'n/a' : fmtPct(analysis.fundamentals.roe * 100, 1)}` : 'n/a'}</strong></div>
        </div>
      </div>
    </div>
  );
}
