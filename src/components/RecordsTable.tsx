'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDateShort, fmtPct, fmtShares, fmtUsd } from './_fmt';
import type { EnrichedPosition } from '@/types';

type Props = {
  records: EnrichedPosition[];
  symbol: string;
};

export default function RecordsTable({ records, symbol }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editShares, setEditShares] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [editFees, setEditFees] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((row) => row.date.includes(q) || String(row.lotNumber).includes(q));
  }, [records, query]);

  function startEdit(row: EnrichedPosition) {
    setEditingId(row.id);
    setEditShares(row.shares);
    setEditPrice(row.price);
    setEditFees(row.fees);
  }

  async function saveEdit(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares: editShares, price: editPrice, fees: editFees }),
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

  async function deleteRow(row: EnrichedPosition) {
    if (!window.confirm(`Delete ${symbol} lot from ${fmtDateShort(row.date)}?`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/entries/${row.id}`, { method: 'DELETE' });
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

  return (
    <div className="records-card">
      <div className="records-toolbar">
        <div className="records-toolbar-left">
          <div className="search">
            <span>⌕</span>
            <input placeholder="Search lot or date..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
            {filtered.length} {symbol} lots
          </span>
        </div>
      </div>

      <div className="records-scroll">
        <table className="records">
          <thead>
            <tr>
              <th className="left">Lot</th>
              <th className="left">Date</th>
              <th>Shares</th>
              <th>Entry</th>
              <th>Fees</th>
              <th>Invested</th>
              <th>Avg Cost</th>
              <th>Market Value</th>
              <th>Unrealized</th>
              <th>% P/L</th>
              <th aria-label="Row actions" style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="left" style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
                  No positions yet. Click Add position to start DCA tracking.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isEditing = editingId === row.id;
                const busy = busyId === row.id;
                const invested = isEditing ? editShares * editPrice + editFees : row.invested;
                return (
                  <tr key={row.id}>
                    <td className="left"><span className="day-chip">{row.lotNumber}</span></td>
                    <td className="left">{fmtDateShort(row.date)}</td>
                    <td className={isEditing ? 'row-edit' : ''}>
                      {isEditing ? <input type="number" value={editShares} min={0.000001} step={0.000001} onChange={(e) => setEditShares(+e.target.value)} /> : fmtShares(row.shares)}
                    </td>
                    <td className={isEditing ? 'row-edit' : ''}>
                      {isEditing ? <input type="number" value={editPrice} min={0.01} step={0.01} onChange={(e) => setEditPrice(+e.target.value)} /> : `$${fmtUsd(row.price)}`}
                    </td>
                    <td className={isEditing ? 'row-edit' : ''}>
                      {isEditing ? <input type="number" value={editFees} min={0} step={0.01} onChange={(e) => setEditFees(+e.target.value)} /> : `$${fmtUsd(row.fees)}`}
                    </td>
                    <td>${fmtUsd(invested)}</td>
                    <td>${fmtUsd(row.averageCost)}</td>
                    <td>${fmtUsd(row.marketValue)}</td>
                    <td className={row.unrealized >= 0 ? 'pos' : 'neg'}>{row.unrealized >= 0 ? '+' : ''}${fmtUsd(row.unrealized)}</td>
                    <td className={row.pctUnrealized >= 0 ? 'pos' : 'neg'}>{fmtPct(row.pctUnrealized)}</td>
                    <td className="row-actions">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(row.id)} disabled={busy} title="Save">✓</button>
                          <button onClick={() => setEditingId(null)} disabled={busy} title="Cancel">x</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)} title="Edit">Edit</button>
                          <button className="danger" onClick={() => deleteRow(row)} title="Delete">Del</button>
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
    </div>
  );
}
