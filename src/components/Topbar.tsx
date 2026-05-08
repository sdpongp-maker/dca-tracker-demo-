'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  activeSymbol: string;
  onAdd: () => void;
  onToggleTweaks: () => void;
  isDark: boolean;
  onToggleDark: () => void;
};

export default function Topbar({ activeSymbol, onAdd, onToggleTweaks, isDark, onToggleDark }: Props) {
  const router = useRouter();
  const [time, setTime] = useState<string>('');
  const [symbol, setSymbol] = useState(activeSymbol);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = symbol.trim().toUpperCase();
    if (!next) return;
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_symbol: next }),
    });
    router.push(`/?symbol=${encodeURIComponent(next)}`);
    router.refresh();
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">$</div>
        <div>
          <div className="brand-name">US Stock Tracker</div>
          <div className="brand-sub">{activeSymbol} · Technical Signals · v1.0.0</div>
        </div>
      </div>
      <div className="topbar-actions">
        <form className="symbol-search" onSubmit={submit}>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} aria-label="Stock symbol" />
          <button className="btn" type="submit">Search</button>
        </form>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>
          {time ? `Last sync · ${time}` : ''}
        </span>
        <button className="btn" onClick={onToggleDark} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? 'Light' : 'Dark'}
        </button>
        <button className="btn" onClick={onToggleTweaks}>Tweaks</button>
        <button className="btn btn-primary" onClick={onAdd}>Add position</button>
      </div>
    </header>
  );
}
