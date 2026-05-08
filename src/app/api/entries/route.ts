import { NextResponse } from 'next/server';
import { insertPosition, listPositions, normalizeSymbol } from '@/lib/db';
import type { ApiResult, Position } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request): Promise<NextResponse<ApiResult<Position[]>>> {
  const url = new URL(req.url);
  const symbol = normalizeSymbol(url.searchParams.get('symbol') ?? 'AMD');
  try {
    return NextResponse.json({ ok: true, data: await listPositions(symbol) });
  } catch {
    return NextResponse.json({ ok: true, data: [] });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResult<Position>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const { symbol, date, shares, price, fees } = body as Record<string, unknown>;
  const normalized = normalizeSymbol(String(symbol ?? 'AMD'));
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }
  const qty = Number(shares);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_shares' }, { status: 400 });
  }
  const entryPrice = Number(price);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || entryPrice > 1_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_price' }, { status: 400 });
  }
  const entryFees = Number(fees ?? 0);
  if (!Number.isFinite(entryFees) || entryFees < 0 || entryFees > 1_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_fees' }, { status: 400 });
  }

  try {
    const row = await insertPosition({
      symbol: normalized,
      date,
      shares: qty,
      price: entryPrice,
      fees: entryFees,
    });
    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: 'sqlserver_unavailable' }, { status: 503 });
  }
}
