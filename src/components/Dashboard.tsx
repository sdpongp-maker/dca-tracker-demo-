'use client';

import { useEffect, useState } from 'react';
import type {
  AiAnalysis,
  Candle,
  EnrichedPosition,
  PortfolioSummary,
  StockQuote,
  TechnicalSnapshot,
  Timeframe,
  WatchlistItem,
} from '@/types';
import Topbar from './Topbar';
import SectionLabel from './SectionLabel';
import PnlCard from './PnlCard';
import ChartCard from './ChartCard';
import StatsGrid from './StatsGrid';
import GoalsComponent from './Goals';
import RecordsTable from './RecordsTable';
import AddBuyModal from './AddBuyModal';
import TweaksPanel, { ACCENTS, type Accent } from './TweaksPanel';

type Props = {
  activeSymbol: string;
  quote: StockQuote;
  candles: Candle[];
  technical: TechnicalSnapshot | null;
  analysis: AiAnalysis;
  watchlist: WatchlistItem[];
  positions: EnrichedPosition[];
  summary: PortfolioSummary | null;
  priceStale: boolean;
  timeframe: Timeframe;
};

export default function Dashboard(props: Props) {
  const [accent, setAccent] = useState<Accent>(ACCENTS[0]!);
  const [showModal, setShowModal] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('dca.accent') : null;
    if (saved) {
      const found = ACCENTS.find((a) => a.name === saved);
      if (found) setAccent(found);
    }
  }, []);

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('dca.theme') : null;
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent.hex);
    root.style.setProperty('--accent-strong', accent.strong);
    root.style.setProperty('--accent-soft', accent.soft);
    root.style.setProperty('--accent-line', accent.line);
    localStorage.setItem('dca.accent', accent.name);
  }, [accent]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    localStorage.setItem('dca.theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div className="shell">
      <Topbar
        activeSymbol={props.activeSymbol}
        onAdd={() => setShowModal(true)}
        onToggleTweaks={() => setShowTweaks((value) => !value)}
        isDark={isDark}
        onToggleDark={() => setIsDark((value) => !value)}
      />

      <SectionLabel num="01" title="Dashboard" hint="quote · watchlist · technical signal" />
      <div className="hero">
        <PnlCard
          quote={props.quote}
          summary={props.summary}
          analysis={props.analysis}
          priceStale={props.priceStale}
        />
        <GoalsComponent
          activeSymbol={props.activeSymbol}
          watchlist={props.watchlist}
          quote={props.quote}
          technical={props.technical}
          analysis={props.analysis}
        />
      </div>

      <SectionLabel num="02" title="Technical Chart" hint="candles · MA · RSI · MACD" />
      <ChartCard
        symbol={props.activeSymbol}
        candles={props.candles}
        timeframe={props.timeframe}
      />
      <StatsGrid
        quote={props.quote}
        summary={props.summary}
        technical={props.technical}
        positions={props.positions}
      />

      <SectionLabel num="03" title="Portfolio & DCA" hint="lots · average cost · target" />
      <RecordsTable records={props.positions} symbol={props.activeSymbol} />

      {showModal && (
        <AddBuyModal
          onClose={() => setShowModal(false)}
          symbol={props.activeSymbol}
          currentPrice={props.quote.price}
        />
      )}
      {showTweaks && (
        <TweaksPanel
          onClose={() => setShowTweaks(false)}
          accent={accent}
          setAccent={setAccent}
        />
      )}
    </div>
  );
}
