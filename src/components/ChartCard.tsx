'use client';
import { useRouter } from 'next/navigation';
import Chart from './Chart';
import type { Candle, Timeframe } from '@/types';

type Props = {
  symbol: string;
  candles: Candle[];
  timeframe: Timeframe;
};

export default function ChartCard({ symbol, candles, timeframe }: Props) {
  const router = useRouter();
  const frames: Timeframe[] = ['1D', '1W', '1M'];

  function setFrame(tf: Timeframe) {
    router.push(`/?symbol=${encodeURIComponent(symbol)}&tf=${tf}`);
    router.refresh();
  }

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div className="chart-tabs">
          <button className="chart-tab active">Candles + MA</button>
          <button className="chart-tab">RSI</button>
          <button className="chart-tab">MACD</button>
          <button className="chart-tab">Swing Levels</button>
        </div>
        <div className="timeframe">
          {frames.map((tf) => (
            <button key={tf} className={timeframe === tf ? 'active' : ''} onClick={() => setFrame(tf)}>
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-body technical-chart-body">
        <Chart candles={candles} />
      </div>
    </div>
  );
}
