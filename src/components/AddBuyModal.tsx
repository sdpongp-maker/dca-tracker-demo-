'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtInt } from './_fmt';

type Props = {
  onClose: () => void;
  currentPrice: number;
};

export default function AddBuyModal({ onClose, currentPrice }: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fiat, setFiat] = useState<number>(108);
  const [price, setPrice] = useState<number>(currentPrice > 0 ? currentPrice : 2_500_000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const satPerTHB = price > 0 ? 100_000_000 / price : 0;
  const sat = Math.floor(fiat * satPerTHB);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, fiat_thb: fiat, price_thb: price }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        const msg = body.error === 'duplicate_date'
          ? `Already have a buy for ${date}`
          : body.error === 'invalid_fiat_thb'
            ? 'Fiat amount must be a positive integer ≤ 10,000,000'
            : body.error === 'invalid_price_thb'
              ? 'Price must be a positive number'
              : body.error || 'Something went wrong';
        setError(msg);
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
          <h3>Record new buy</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            {error && error.startsWith('Already') && (
              <div style={{ color: 'var(--neg)', fontSize: 11, marginTop: 4 }}>{error}</div>
            )}
          </div>
          <div className="field-pair">
            <div className="field">
              <label>Fiat spent (฿)</label>
              <input
                type="number"
                value={fiat}
                min={1}
                max={10_000_000}
                step={1}
                onChange={(e) => setFiat(+e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>BTC price (฿)</label>
              <input
                type="number"
                value={price}
                min={1}
                max={100_000_000}
                step={0.01}
                onChange={(e) => setPrice(+e.target.value)}
                required
              />
            </div>
          </div>
          <div className="preview-row">
            <span>You get</span>
            <strong>{fmtInt(sat)} sat · {satPerTHB.toFixed(2)} sat/฿</strong>
          </div>
          {error && !error.startsWith('Already') && (
            <div style={{ color: 'var(--neg)', fontSize: 12, marginTop: 8 }}>{error}</div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record buy'}
          </button>
        </div>
      </form>
    </div>
  );
}
