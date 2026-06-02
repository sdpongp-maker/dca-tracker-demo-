'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle } from '@/types';

type ChartProps = {
  candles: Candle[];
};

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function pathFor(values: Array<number | null | undefined>, x: (i: number) => number, y: (v: number) => number): string {
  let path = '';
  values.forEach((value, index) => {
    if (value === null || value === undefined) return;
    path += `${path ? ' L' : 'M'} ${x(index)} ${y(value)}`;
  });
  return path;
}

export default function Chart({ candles }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 360 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setDims({ w: rect.width, h: rect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => candles, [candles]);
  const { w, h } = dims;
  const padL = 56;
  const padR = 18;
  const padT = 14;
  const padB = 92;
  const priceH = Math.max(120, h - padT - padB);
  const rsiTop = padT + priceH + 22;
  const rsiH = 42;
  const macdTop = rsiTop + rsiH + 18;
  const macdH = 46;
  const cw = Math.max(1, w - padL - padR);

  const prices = data.flatMap((row) => [row.high, row.low, row.ma20 ?? row.close, row.ma50 ?? row.close]);
  let yMin = prices.length ? Math.min(...prices) : 0;
  let yMax = prices.length ? Math.max(...prices) : 1;
  const range = yMax - yMin || 1;
  yMin -= range * 0.08;
  yMax += range * 0.08;

  const macdVals = data.flatMap((row) => [row.macd ?? 0, row.macdSignal ?? 0, row.macdHist ?? 0]);
  const macdMax = Math.max(0.01, ...macdVals.map(Math.abs));

  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * cw);
  const y = (v: number) => padT + priceH - ((v - yMin) / (yMax - yMin)) * priceH;
  const yRsi = (v: number) => rsiTop + rsiH - (Math.max(0, Math.min(100, v)) / 100) * rsiH;
  const yMacd = (v: number) => macdTop + macdH / 2 - (v / macdMax) * (macdH / 2);
  const candleW = Math.max(4, Math.min(14, cw / Math.max(data.length, 1) * 0.55));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - padL) / cw;
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  }

  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = yMin + ((yMax - yMin) / 4) * index;
    return { value, y: y(value) };
  });
  const hovered = hoverIdx === null ? null : data[hoverIdx] ?? null;

  return (
    <div ref={wrapRef} style={{ height: '100%', position: 'relative' }} onMouseLeave={() => setHoverIdx(null)}>
      {data.length === 0 ? (
        <div className="chart-empty">
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Search a US symbol to load candles</span>
        </div>
      ) : (
        <>
          <svg width={w} height={h} style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
            {grid.map((line) => (
              <g key={line.value}>
                <line x1={padL} x2={w - padR} y1={line.y} y2={line.y} stroke="var(--divider)" />
                <text x={padL - 8} y={line.y + 3} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">
                  {fmt(line.value)}
                </text>
              </g>
            ))}
            {data.map((row, index) => {
              const up = row.close >= row.open;
              const color = up ? 'var(--pos)' : 'var(--neg)';
              const cx = x(index);
              const top = y(Math.max(row.open, row.close));
              const bottom = y(Math.min(row.open, row.close));
              return (
                <g key={row.date}>
                  <line x1={cx} x2={cx} y1={y(row.high)} y2={y(row.low)} stroke={color} strokeWidth="1.2" />
                  <rect
                    x={cx - candleW / 2}
                    y={top}
                    width={candleW}
                    height={Math.max(2, bottom - top)}
                    fill={up ? 'var(--pos-soft)' : 'var(--neg-soft)'}
                    stroke={color}
                  />
                </g>
              );
            })}
            <path d={pathFor(data.map((row) => row.ma20), x, y)} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
            <path d={pathFor(data.map((row) => row.ma50), x, y)} fill="none" stroke="var(--fg-2)" strokeWidth="1.4" strokeDasharray="4 4" />
            <line x1={padL} x2={w - padR} y1={yRsi(70)} y2={yRsi(70)} stroke="var(--neg)" strokeDasharray="2 3" opacity="0.55" />
            <line x1={padL} x2={w - padR} y1={yRsi(30)} y2={yRsi(30)} stroke="var(--pos)" strokeDasharray="2 3" opacity="0.55" />
            <path d={pathFor(data.map((row) => row.rsi14), x, yRsi)} fill="none" stroke="var(--accent)" strokeWidth="1.4" />
            <text x={padL - 8} y={rsiTop + 12} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">RSI</text>
            <line x1={padL} x2={w - padR} y1={yMacd(0)} y2={yMacd(0)} stroke="var(--divider)" />
            {data.map((row, index) => (
              <rect
                key={`${row.date}-macd`}
                x={x(index) - candleW / 2}
                y={row.macdHist && row.macdHist >= 0 ? yMacd(row.macdHist) : yMacd(0)}
                width={candleW}
                height={Math.max(1, Math.abs(yMacd(row.macdHist ?? 0) - yMacd(0)))}
                fill={(row.macdHist ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)'}
                opacity="0.55"
              />
            ))}
            <path d={pathFor(data.map((row) => row.macd), x, yMacd)} fill="none" stroke="var(--fg)" strokeWidth="1.2" />
            <path d={pathFor(data.map((row) => row.macdSignal), x, yMacd)} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
            <text x={padL - 8} y={macdTop + 12} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">MACD</text>
            {hoverIdx !== null && (
              <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={macdTop + macdH} stroke="var(--fg)" strokeDasharray="2 3" opacity="0.45" />
            )}
          </svg>
          <div className="chart-legend stock-legend">
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent)' }} />MA20</span>
            <span className="legend-item"><span className="legend-swatch" style={{ border: '2px dashed var(--fg-2)', height: 0 }} />MA50</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--pos)' }} />Up candle</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--neg)' }} />Down candle</span>
          </div>
          {hovered && hoverIdx !== null && (
            <div
              className="tooltip visible"
              style={{
                left: x(hoverIdx),
                top: 0,
                transform: x(hoverIdx) > padL + cw * 0.65 ? 'translate(-100%, 0)' : 'translate(-50%, 0)',
              }}
            >
              <div className="t-date">{hovered.date}</div>
              <div className="t-row"><span className="t-lbl">O/H/L/C</span><span>{fmt(hovered.open)} / {fmt(hovered.high)} / {fmt(hovered.low)} / {fmt(hovered.close)}</span></div>
              <div className="t-row"><span className="t-lbl">RSI</span><span>{fmt(hovered.rsi14)}</span></div>
              <div className="t-row"><span className="t-lbl">MACD</span><span>{fmt(hovered.macdHist, 3)}</span></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
