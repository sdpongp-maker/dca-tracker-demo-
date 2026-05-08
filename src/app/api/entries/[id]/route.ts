import { NextResponse } from 'next/server';
import { deletePosition, updatePosition } from '@/lib/db';
import type { ApiResult, Position } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteCtx): Promise<NextResponse<ApiResult<Position>>> {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const { shares, price, fees } = body as Record<string, unknown>;
  const qty = Number(shares);
  const entryPrice = Number(price);
  const entryFees = Number(fees ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_shares' }, { status: 400 });
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_price' }, { status: 400 });
  }
  if (!Number.isFinite(entryFees) || entryFees < 0) {
    return NextResponse.json({ ok: false, error: 'invalid_fees' }, { status: 400 });
  }

  try {
    const row = await updatePosition(id, { shares: qty, price: entryPrice, fees: entryFees });
    if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: row });
  } catch {
    return NextResponse.json({ ok: false, error: 'sqlserver_unavailable' }, { status: 503 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx): Promise<NextResponse<ApiResult<{ id: number }>>> {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }
  try {
    const deleted = await deletePosition(id);
    if (!deleted) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: { id } });
  } catch {
    return NextResponse.json({ ok: false, error: 'sqlserver_unavailable' }, { status: 503 });
  }
}
