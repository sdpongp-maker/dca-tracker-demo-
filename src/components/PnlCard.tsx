import { fmtPct, fmtUsd } from './_fmt';
import type { AiAnalysis, PortfolioSummary, StockQuote } from '@/types';

type Props = {
  quote: StockQuote;
  summary: PortfolioSummary | null;
  analysis: AiAnalysis;
  priceStale: boolean;
};

export default function PnlCard({ quote, summary, analysis, priceStale }: Props) {
  const signalClass = analysis.signal === 'BUY' ? 'pos' : analysis.signal === 'SELL' ? 'neg' : 'neutral';
  const pnl = summary?.unrealized ?? quote.change;
  const pnlPct = summary?.pctProfitLoss ?? quote.changePct;

  return (
    <div className="pnl-card">
      <div className="pnl-head">
        <span>{quote.symbol} Quote</span>
        <span className="live" title={priceStale ? 'Using fallback/demo price' : quote.source}>
          <span className="live-dot" style={priceStale ? { background: 'var(--muted)' } : undefined} />
          {priceStale ? 'FALLBACK' : 'LIVE'}
        </span>
      </div>
      <div>
        <div className="pnl-value">
          <span className="currency">$</span>
          {fmtUsd(quote.price)}
        </div>
        <div className="pnl-delta">
          <span className={'chip ' + (quote.change >= 0 ? 'pos' : 'neg')}>
            {quote.change >= 0 ? '+' : ''}{fmtUsd(quote.change)} · {fmtPct(quote.changePct)}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {quote.source}
          </span>
        </div>
      </div>
      <div className="pnl-split">
        <div>
          <div className="lbl">Composite Signal</div>
          <div className="val">
            <span className={'chip ' + signalClass}>{analysis.signal}</span>
            <span className="unit">{analysis.totalScore}/100</span>
          </div>
        </div>
        <div>
          <div className="lbl">Scores</div>
          <div className="val" style={{ color: pnl >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            T{analysis.technicalScore} F{analysis.fundamentalScore}
            <span className="unit">V{analysis.valuationScore} A{analysis.analystScore}</span>
          </div>
        </div>
      </div>
      <div className="pnl-meta">
        <span>{analysis.summary}</span>
        {summary && (
          <span>
            Portfolio {pnl >= 0 ? '+' : ''}${fmtUsd(pnl)} ({fmtPct(pnlPct)})
          </span>
        )}
      </div>
    </div>
  );
}
