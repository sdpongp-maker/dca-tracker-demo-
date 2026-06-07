'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { EnrichedEntry } from '@/types';

type Mode = 'portfolio' | 'pnl' | 'cost' | 'sats' | 'entries';
type Timeframe = '7D' | '30D' | '60D' | '90D' | '180D' | '1Y' | '2Y' | '4Y' | 'ALL';

type ChartProps = {
  records: EnrichedEntry[];
  mode: Mode;
  timeframe: Timeframe;
};

type SeriesItem = {
  key: string;
  label: string;
  color: string;
  fill: string | undefined;
  dash: string | undefined;
  zero: boolean;
  values: number[];
  rightAxis?: boolean;
};

function formatTHB(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function formatTHBFull(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatSat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return n.toLocaleString('en-US');
}

function Chart({ records, mode, timeframe }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 280 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const sliceMap: Record<Timeframe, number> = {
      '7D': 7, '30D': 30, '60D': 60, '90D': 90, '180D': 180,
      '1Y': 365, '2Y': 730, '4Y': 1460, 'ALL': Infinity,
    };
    const n = sliceMap[timeframe];
    return n === Infinity ? records : records.slice(-n);
  }, [records, timeframe]);

  const { w, h } = dims;
  const padL = 52;
  // sats mode needs right padding for the THB axis labels
  const padR = mode === 'sats' ? 52 : 16;
  const padT = 20, padB = 28;
  const cw = Math.max(0, w - padL - padR);
  const ch = Math.max(0, h - padT - padB);

  const series: SeriesItem[] = useMemo(() => {
    if (mode === 'portfolio') {
      return [
        { key: 'portfolio', label: 'Portfolio Value', color: 'var(--accent)', fill: 'var(--accent-line)', dash: undefined, zero: false, values: data.map((d) => d.portfolioValue) },
        { key: 'invested', label: 'Invested', color: 'var(--fg-2)', dash: '4 4', fill: undefined, zero: false, values: data.map((d) => d.invested) },
      ];
    }
    if (mode === 'pnl') {
      return [
        { key: 'unrealized', label: 'Unrealized PNL', color: 'var(--accent)', fill: 'var(--accent-line)', dash: undefined, zero: true, values: data.map((d) => d.unrealized) },
      ];
    }
    if (mode === 'sats') {
      return [
        { key: 'sats', label: 'Cumulative Satoshi', color: 'var(--accent)', fill: 'var(--accent-line)', dash: undefined, zero: false, values: data.map((d) => d.cumSat) },
        { key: 'portfolio-thb', label: 'Portfolio Value (฿)', color: 'var(--fg)', fill: undefined, dash: undefined, zero: false, values: data.map((d) => d.portfolioValue), rightAxis: true },
        { key: 'invested-thb', label: 'Invested (฿)', color: 'var(--fg)', fill: undefined, dash: '4 4', zero: false, values: data.map((d) => d.invested), rightAxis: true },
      ];
    }
    if (mode === 'entries') {
      return [
        { key: 'price', label: 'BTC Price', color: 'var(--muted)', fill: undefined, dash: undefined, zero: false, values: data.map((d) => d.price_thb) },
        {
          key: 'cost', label: 'Avg Cost Basis', color: 'var(--fg-2)', dash: '4 4', fill: undefined, zero: false, values: data.map((_d, i) => {
            const slice = data.slice(0, i + 1);
            const totalSat  = slice.reduce((s, r) => s + r.satoshi, 0);
            const totalFiat = slice.reduce((s, r) => s + r.fiat_thb, 0);
            return totalFiat / (totalSat / 1e8);
          }),
        },
      ];
    }
    // cost
    return [
      { key: 'market', label: 'Market Price', color: 'var(--accent)', fill: undefined, dash: undefined, zero: false, values: data.map((d) => d.price_thb) },
      {
        key: 'cost', label: 'Avg Cost Basis', color: 'var(--fg-2)', dash: '4 4', fill: undefined, zero: false, values: data.map((_d, i) => {
          const slice = data.slice(0, i + 1);
          const totalSat = slice.reduce((s, r) => s + r.satoshi, 0);
          const totalFiat = slice.reduce((s, r) => s + r.fiat_thb, 0);
          return totalFiat / (totalSat / 1e8);
        }),
      },
    ];
  }, [data, mode]);

  // Left Y scale — uses only non-rightAxis series
  const leftVals = series.filter((s) => !s.rightAxis).flatMap((s) => s.values);
  let yMin = leftVals.length > 0 ? Math.min(...leftVals) : 0;
  let yMax = leftVals.length > 0 ? Math.max(...leftVals) : 1;
  if (series.find((s) => s.zero)) {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.06;
  yMax += yRange * 0.06;

  // Right Y scale — only used in sats mode
  const rightVals = series.filter((s) => s.rightAxis).flatMap((s) => s.values);
  let yMinR = rightVals.length > 0 ? Math.min(...rightVals) : 0;
  let yMaxR = rightVals.length > 0 ? Math.max(...rightVals) : 1;
  const yRangeR = yMaxR - yMinR || 1;
  yMinR -= yRangeR * 0.06;
  yMaxR += yRangeR * 0.06;

  const x  = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * cw);
  const y  = (v: number) => padT + ch - ((v - yMin)  / (yMax  - yMin)  ) * ch;
  const yR = (v: number) => padT + ch - ((v - yMinR) / (yMaxR - yMinR) ) * ch;

  const yFn = (s: SeriesItem) => s.rightAxis ? yR : y;

  const gridLines = 4;
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) / gridLines) * i;
    return { v, y: y(v) };
  });
  const gridR = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = yMinR + ((yMaxR - yMinR) / gridLines) * i;
    return { v, y: yR(v) };
  });

  const zeroY = yMin < 0 && yMax > 0 ? y(0) : null;

  function buildPath(values: number[], withArea: boolean, yFunc: (v: number) => number): string {
    if (values.length === 0) return '';
    let d = `M ${x(0)} ${yFunc(values[0]!)}`;
    for (let i = 1; i < values.length; i++) d += ` L ${x(i)} ${yFunc(values[i]!)}`;
    if (withArea) {
      const baseY = zeroY !== null ? zeroY : padT + ch;
      d += ` L ${x(values.length - 1)} ${baseY} L ${x(0)} ${baseY} Z`;
    }
    return d;
  }

  const xTickCount = Math.min(6, data.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1 || 1)) * (data.length - 1));
    const entry = data[idx];
    return { idx, x: x(idx), date: entry ? entry.date : undefined };
  });

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    if (mx < padL) { setHoverIdx(null); return; }
    const rel = (mx - padL) / cw;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1))));
    setHoverIdx(idx);
  }
  function onLeave() { setHoverIdx(null); }

  const hovered = hoverIdx !== null ? (data[hoverIdx] ?? null) : null;

  const tooltipRows: { lbl: string; val: string }[] = [];
  if (hovered) {
    if (mode === 'portfolio') {
      tooltipRows.push(
        { lbl: 'Portfolio', val: formatTHBFull(hovered.portfolioValue) + ' ฿' },
        { lbl: 'Invested', val: formatTHBFull(hovered.invested) + ' ฿' },
        { lbl: 'Unrealized', val: (hovered.unrealized >= 0 ? '+' : '') + formatTHBFull(hovered.unrealized) + ' ฿' },
      );
    } else if (mode === 'pnl') {
      tooltipRows.push(
        { lbl: 'Unrealized', val: (hovered.unrealized >= 0 ? '+' : '') + formatTHBFull(hovered.unrealized) + ' ฿' },
        { lbl: '%', val: hovered.pctUnrealized.toFixed(2) + '%' },
        { lbl: 'Portfolio', val: formatTHBFull(hovered.portfolioValue) + ' ฿' },
      );
    } else if (mode === 'sats') {
      tooltipRows.push(
        { lbl: 'Cumulative', val: hovered.cumSat.toLocaleString('en-US') + ' sat' },
        { lbl: "Today's buy", val: hovered.satoshi.toLocaleString('en-US') + ' sat' },
        { lbl: 'Portfolio', val: formatTHBFull(hovered.portfolioValue) + ' ฿' },
        { lbl: 'Invested', val: formatTHBFull(hovered.invested) + ' ฿' },
      );
    } else if (mode === 'entries') {
      tooltipRows.push(
        { lbl: 'BTC Price', val: formatTHBFull(hovered.price_thb) + ' ฿' },
        { lbl: 'Bought', val: hovered.satoshi.toLocaleString('en-US') + ' sat' },
        { lbl: 'Spent', val: hovered.fiat_thb.toLocaleString('en-US') + ' ฿' },
      );
    } else {
      const slice = hoverIdx !== null ? data.slice(0, hoverIdx + 1) : [];
      const tSat = slice.reduce((s, r) => s + r.satoshi, 0);
      const tFiat = slice.reduce((s, r) => s + r.fiat_thb, 0);
      const costBasis = tFiat / (tSat / 1e8);
      tooltipRows.push(
        { lbl: 'Market Price', val: formatTHBFull(hovered.price_thb) + ' ฿' },
        { lbl: 'Avg Cost', val: formatTHBFull(costBasis) + ' ฿' },
        { lbl: 'Spread', val: ((hovered.price_thb - costBasis) / costBasis * 100).toFixed(2) + '%' },
      );
    }
  }

  const legend = series.map((s) => (
    <span key={s.key} className="legend-item">
      <span
        className="legend-swatch"
        style={{
          background: s.dash ? 'transparent' : s.color,
          border: s.dash ? `2px dashed ${s.color}` : 'none',
          height: s.dash ? 0 : 10,
        }}
      />
      {s.label}
    </span>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {records.length === 0 ? (
        <div className="chart-empty">
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Add your first buy to see chart</span>
        </div>
      ) : (
        <>
          <div className="chart-legend">{legend}</div>
          <div ref={wrapRef} style={{ flex: 1, position: 'relative', minHeight: 0 }} onMouseMove={() => {}} onMouseLeave={onLeave}>
            <svg width={w} height={h} style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={onLeave}>
              {/* left Y grid + labels */}
              {grid.map((g, i) => (
                <g key={i}>
                  <line x1={padL} x2={w - padR} y1={g.y} y2={g.y} stroke="var(--divider)" strokeWidth="1" />
                  <text x={padL - 8} y={g.y + 3} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">
                    {mode === 'sats' ? formatSat(g.v) : formatTHB(g.v)}
                  </text>
                </g>
              ))}
              {/* right Y labels — sats mode only */}
              {mode === 'sats' && gridR.map((g, i) => (
                <text key={'r' + i} x={w - padR + 8} y={g.y + 3} textAnchor="start" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">
                  {formatTHB(g.v)}
                </text>
              ))}
              {/* zero line for pnl */}
              {zeroY !== null && (
                <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY} stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              )}
              {/* x ticks */}
              {xTicks.map((t, i) => {
                const anchor = i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle';
                return (
                  <text key={i} x={t.x} y={h - 8} textAnchor={anchor} fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">
                    {t.date ? formatDateShort(new Date(t.date + 'T00:00:00')) : ''}
                  </text>
                );
              })}
              {/* area fills */}
              {series.map((s) => s.fill && (
                <path key={s.key + '-area'} d={buildPath(s.values, true, yFn(s))} fill={s.fill} stroke="none" />
              ))}
              {/* lines */}
              {series.map((s) => (
                <path
                  key={s.key + '-line'}
                  d={buildPath(s.values, false, yFn(s))}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.75"
                  strokeDasharray={s.dash ?? 'none'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {/* entry dots for 'entries' mode */}
              {mode === 'entries' && data.map((d, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(d.price_thb)}
                  r="3.5"
                  fill="var(--accent)"
                  opacity="0.75"
                />
              ))}
              {/* hover crosshair */}
              {hoverIdx !== null && (
                <g>
                  <line
                    x1={x(hoverIdx)} x2={x(hoverIdx)}
                    y1={padT} y2={padT + ch}
                    stroke="var(--fg)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5"
                  />
                  {series.map((s) => (
                    <circle
                      key={s.key + '-dot'}
                      cx={x(hoverIdx)} cy={yFn(s)(s.values[hoverIdx] ?? 0)}
                      r="4" fill="var(--surface)"
                      stroke={s.color} strokeWidth="2"
                    />
                  ))}
                </g>
              )}
            </svg>
            {hovered && hoverIdx !== null && (
              <div
                className="tooltip visible"
                style={{
                  left: x(hoverIdx),
                  top: 0,
                  transform: x(hoverIdx) > padL + cw * 0.65
                    ? 'translate(-100%, -100%)'
                    : 'translate(-50%, -100%)',
                }}
              >
                <div className="t-date">{formatDate(new Date(hovered.date + 'T00:00:00'))} · Day {hovered.dayActive}</div>
                {tooltipRows.map((r, i) => (
                  <div className="t-row" key={i}>
                    <span className="t-lbl">{r.lbl}</span>
                    <span>{r.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Chart;
