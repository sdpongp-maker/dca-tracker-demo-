'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtInt, fmtThb, fmtDateShort } from './_fmt';
import type { EnrichedEntry } from '@/types';

type Column = {
  key: keyof EnrichedEntry | 'pctUnrealized';
  label: string;
  align?: 'left';
  fmt: (value: number | string, row: EnrichedEntry) => React.ReactNode;
  cls?: (value: number) => 'pos' | 'neg' | '';
};

const COLUMNS: Column[] = [
  { key: 'dayActive', label: 'Day', align: 'left', fmt: (v) => <span className="day-chip">{v}</span> },
  { key: 'date', label: 'Date', align: 'left', fmt: (v) => fmtDateShort(v as string) },
  { key: 'fiat_thb',  label: 'Fiat (฿)',       fmt: (v) => fmtInt(v as number) },
  { key: 'satoshi',   label: 'Satoshi',        fmt: (v) => fmtInt(v as number) },
  { key: 'price_thb', label: 'BTC Price',      fmt: (v) => fmtThb(v as number) },
  { key: 'portfolioValue', label: 'Portfolio Value', fmt: (v) => fmtThb(v as number) },
  { key: 'invested',  label: 'Invested',       fmt: (v) => fmtInt(v as number) },
  { key: 'unrealized', label: 'Unrealized',    fmt: (v) => ((v as number) >= 0 ? '+' : '') + fmtThb(v as number), cls: (v) => v >= 0 ? 'pos' : 'neg' },
  { key: 'pctUnrealized', label: '% Unrealized', fmt: (v) => ((v as number) >= 0 ? '+' : '') + (v as number).toFixed(2) + '%', cls: (v) => v >= 0 ? 'pos' : 'neg' },
];

type Props = { records: EnrichedEntry[] };

export default function RecordsTable({ records }: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<Column['key']>('dayActive');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFiat, setEditFiat] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  function startEdit(r: EnrichedEntry) {
    setEditingId(r.id);
    setEditFiat(r.fiat_thb);
    setEditPrice(r.price_thb);
  }

  async function saveEdit(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiat_thb: editFiat, price_thb: editPrice }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        window.alert(body.error || 'Save failed');
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(r: EnrichedEntry) {
    if (!window.confirm(`Delete entry for ${fmtDateShort(r.date)}?`)) return;
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/entries/${r.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        window.alert(body.error || 'Delete failed');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter((r) => {
      return String(r.dayActive).includes(q)
        || fmtDateShort(r.date).toLowerCase().includes(q)
        || String(r.price_thb).includes(q);
    });
  }, [records, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey as string];
      const bv = (b as unknown as Record<string, unknown>)[sortKey as string];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageData = sorted.slice((curPage - 1) * pageSize, curPage * pageSize);

  useEffect(() => { setPage(1); }, [pageSize, query, sortKey, sortDir]);

  function toggleSort(key: Column['key']) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function pageNums(): Array<number | '…'> {
    if (totalPages <= 7) {
      const nums: number[] = [];
      for (let i = 1; i <= totalPages; i++) nums.push(i);
      return nums;
    }
    if (curPage <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (curPage >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', curPage - 1, curPage, curPage + 1, '…', totalPages];
  }

  return (
    <div className="records-card">
      <div className="records-toolbar">
        <div className="records-toolbar-left">
          <div className="search">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" /><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <input placeholder="Search day, date, price…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
            {filtered.length} records
          </span>
        </div>
        <div className="records-toolbar-right">
          <span>Rows per page</span>
          <select className="select" value={pageSize} onChange={(e) => setPageSize(+e.target.value)}>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>

      <div className="records-scroll">
        <table className="records">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={String(c.key)}
                  className={(c.align === 'left' ? 'left ' : '') + (sortKey === c.key ? 'sorted' : '')}
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label}
                  <span className="sort-arrow">
                    {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              ))}
              <th aria-label="Row actions" style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="left" style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
                  No records. Click Add buy to start.
                </td>
              </tr>
            ) : (
              pageData.map((r) => {
                const isEditing = editingId === r.id;
                const busy = busyId === r.id;
                return (
                  <tr key={r.id}>
                    {COLUMNS.map((c) => {
                      if (isEditing && c.key === 'fiat_thb') {
                        return (
                          <td key="fiat_thb" className="row-edit">
                            <input type="number" value={editFiat} min={1} onChange={(e) => setEditFiat(+e.target.value)} />
                          </td>
                        );
                      }
                      if (isEditing && c.key === 'price_thb') {
                        return (
                          <td key="price_thb" className="row-edit">
                            <input type="number" value={editPrice} min={1} onChange={(e) => setEditPrice(+e.target.value)} />
                          </td>
                        );
                      }
                      if (isEditing && c.key === 'satoshi') {
                        const satPerTHB = editPrice > 0 ? 1e8 / editPrice : 0;
                        return <td key="satoshi">{fmtInt(Math.floor(editFiat * satPerTHB))}</td>;
                      }
                      const raw = (r as unknown as Record<string, number | string>)[c.key as string];
                      const cls = c.cls && typeof raw === 'number' ? c.cls(raw) : '';
                      return (
                        <td key={String(c.key)} className={(c.align === 'left' ? 'left ' : '') + cls}>
                          {c.fmt(raw!, r)}
                        </td>
                      );
                    })}
                    <td className="row-actions">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(r.id)} disabled={busy} title="Save">✓</button>
                          <button onClick={() => setEditingId(null)} disabled={busy} title="Cancel">✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          </button>
                          <button className="danger" onClick={() => deleteRow(r)} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M4.5 4v10h7V4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>
          {sorted.length === 0
            ? 'Showing 0 of 0'
            : `Showing ${(curPage - 1) * pageSize + 1}–${Math.min(curPage * pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="pager">
          <button disabled={curPage === 1} onClick={() => setPage(1)}>«</button>
          <button disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>‹</button>
          {pageNums().map((n, i) => (
            n === '…'
              ? <button key={i} disabled style={{ border: 'none', background: 'transparent' }}>…</button>
              : <button key={i} className={n === curPage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}>›</button>
          <button disabled={curPage === totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      </div>
    </div>
  );
}
