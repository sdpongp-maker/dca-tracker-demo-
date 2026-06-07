'use client';
import { useEffect, useState } from 'react';

type Props = {
  onAdd: () => void;
  onToggleTweaks: () => void;
  isDark: boolean;
  onToggleDark: () => void;
};

export default function Topbar({ onAdd, onToggleTweaks, isDark, onToggleDark }: Props) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">₿</div>
        <div>
          <div className="brand-name">DCA Tracker Demo</div>
          <div className="brand-sub">sats/THB · v1.2.1</div>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 12 }}>
          {time ? `Last sync · ${time}` : ''}
        </span>
        <button className="btn" onClick={onToggleDark} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button className="btn" onClick={onToggleTweaks}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" strokeWidth="1.3"/></svg>
          Tweaks
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          Add buy
        </button>
      </div>
    </header>
  );
}
