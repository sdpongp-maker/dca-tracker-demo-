'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtShares, fmtUsd } from './_fmt';

type Props = {
  onClose: () => void;
  symbol: string;
  currentPrice: number;
};

export default function AddBuyModal({ onClose, symbol, currentPrice }: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shares, setShares] = useState<number>(1);
  const [price, setPrice] = useState<number>(currentPrice > 0 ? currentPrice : 100);
  const [fees, setFees] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invested = shares * price + fees;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, date, shares, price, fees }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.error || 'Save failed');
        return;
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>Add {symbol} position</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '2px 8px' }}>x</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Trade date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field-pair">
            <div className="field">
              <label>Shares</label>
              <input type="number" value={shares} min={0.000001} step={0.000001} onChange={(e) => setShares(+e.target.value)} required />
            </div>
            <div className="field">
              <label>Entry price ($)</label>
              <input type="number" value={price} min={0.01} step={0.01} onChange={(e) => setPrice(+e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Fees ($)</label>
            <input type="number" value={fees} min={0} step={0.01} onChange={(e) => setFees(+e.target.value)} />
          </div>
          <div className="preview-row">
            <span>Cost basis</span>
            <strong>{fmtShares(shares)} sh · ${fmtUsd(invested)}</strong>
          </div>
          {error && <div style={{ color: 'var(--neg)', fontSize: 12, marginTop: 8 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save position'}
          </button>
        </div>
      </form>
    </div>
  );
}
