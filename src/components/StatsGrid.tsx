import { fmtPct, fmtShares, fmtUsd } from './_fmt';
import Sparkline from './Sparkline';
import type { EnrichedPosition, PortfolioSummary, StockQuote, TechnicalSnapshot } from '@/types';

type Props = {
  quote: StockQuote;
  summary: PortfolioSummary | null;
  technical: TechnicalSnapshot | null;
  positions: EnrichedPosition[];
};

type StatCell = {
  lbl: string;
  val: string;
  sub: string;
  foot: string;
  spark: number[] | null;
  color: string;
};

export default function StatsGrid({ quote, summary, technical, positions }: Props) {
  const marketSeries = positions.map((row) => row.marketValue);
  const investedSeries = positions.map((row) => row.cumInvested);
  const cells: StatCell[] = [
    {
      lbl: 'Current Price',
      val: fmtUsd(quote.price),
      sub: 'USD',
      foot: `${quote.symbol} · ${quote.source}`,
      spark: null,
      color: quote.change >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
    {
      lbl: 'Total Shares',
      val: summary ? fmtShares(summary.totalShares) : '—',
      sub: 'sh',
      foot: `${positions.length} lots`,
      spark: positions.map((row) => row.cumShares),
      color: 'var(--accent)',
    },
    {
      lbl: 'Average Cost',
      val: summary ? fmtUsd(summary.averageCost) : '—',
      sub: 'USD',
      foot: summary ? `${fmtPct(((quote.price - summary.averageCost) / summary.averageCost) * 100)} vs cost` : 'No portfolio data',
      spark: positions.map((row) => row.averageCost),
      color: 'var(--fg)',
    },
    {
      lbl: 'Market Value',
      val: summary ? fmtUsd(summary.marketValue) : '—',
      sub: 'USD',
      foot: 'Portfolio value',
      spark: marketSeries,
      color: summary && summary.unrealized >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
    {
      lbl: 'Invested',
      val: summary ? fmtUsd(summary.totalInvested) : '—',
      sub: 'USD',
      foot: 'Including fees',
      spark: investedSeries,
      color: 'var(--fg)',
    },
    {
      lbl: 'RSI 14',
      val: technical?.latest?.rsi14?.toFixed(1) ?? '—',
      sub: '',
      foot: technical?.rsiLabel ?? 'Waiting for candles',
      spark: null,
      color: technical?.rsiLabel === 'Overbought' ? 'var(--neg)' : technical?.rsiLabel === 'Oversold' ? 'var(--pos)' : 'var(--fg)',
    },
    {
      lbl: 'MACD',
      val: technical?.latest?.macdHist?.toFixed(3) ?? '—',
      sub: '',
      foot: technical?.macdLabel ?? '—',
      spark: null,
      color: (technical?.latest?.macdHist ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
    {
      lbl: 'Support',
      val: technical ? fmtUsd(technical.support) : '—',
      sub: 'USD',
      foot: '20-candle low',
      spark: null,
      color: 'var(--pos)',
    },
    {
      lbl: 'Resistance',
      val: technical ? fmtUsd(technical.resistance) : '—',
      sub: 'USD',
      foot: '20-candle high',
      spark: null,
      color: 'var(--neg)',
    },
    {
      lbl: 'Forecast 1M',
      val: technical?.forecast.find((row) => row.horizon === '1M') ? fmtUsd(technical.forecast.find((row) => row.horizon === '1M')!.price) : '—',
      sub: 'USD',
      foot: technical?.forecast.find((row) => row.horizon === '1M') ? `${fmtPct(technical.forecast.find((row) => row.horizon === '1M')!.changePct)} model` : 'Needs candles',
      spark: null,
      color: 'var(--accent)',
    },
    {
      lbl: 'Forecast 3M',
      val: technical?.forecast.find((row) => row.horizon === '3M') ? fmtUsd(technical.forecast.find((row) => row.horizon === '3M')!.price) : '—',
      sub: 'USD',
      foot: technical?.forecast.find((row) => row.horizon === '3M') ? `${fmtPct(technical.forecast.find((row) => row.horizon === '3M')!.changePct)} model` : 'Needs candles',
      spark: null,
      color: 'var(--fg)',
    },
    {
      lbl: 'Forecast 6M',
      val: technical?.forecast.find((row) => row.horizon === '6M') ? fmtUsd(technical.forecast.find((row) => row.horizon === '6M')!.price) : '—',
      sub: 'USD',
      foot: technical?.forecast.find((row) => row.horizon === '6M') ? `${fmtPct(technical.forecast.find((row) => row.horizon === '6M')!.changePct)} model` : 'Needs candles',
      spark: null,
      color: 'var(--fg)',
    },
  ];

  return (
    <div className="stats-grid">
      {cells.map((cell) => (
        <div className="stat" key={cell.lbl}>
          <div className="stat-lbl">{cell.lbl}</div>
          <div className="stat-val" style={{ color: cell.color }}>
            {cell.val}
            {cell.sub && <span className="sub">{cell.sub}</span>}
          </div>
          <div className="stat-foot">{cell.foot}</div>
          {cell.spark && cell.spark.length >= 2 && <Sparkline values={cell.spark} color={cell.color} />}
        </div>
      ))}
    </div>
  );
}
