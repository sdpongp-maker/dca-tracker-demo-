import { NextResponse } from 'next/server';
import { addWatchlist, deleteWatchlist, listWatchlist } from '@/lib/db';
import type { ApiResult, WatchlistItem } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<ApiResult<WatchlistItem[]>>> {
  try {
    return NextResponse.json({ ok: true, data: await listWatchlist() });
  } catch {
    return NextResponse.json({
      ok: true,
      data: fallbackWatchlist(),
    });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResult<WatchlistItem>>> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const { symbol, name, note } = body as Record<string, unknown>;
  try {
    const row = await addWatchlist(String(symbol ?? ''), String(name ?? ''), String(note ?? ''));
    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: 'sqlserver_unavailable' }, { status: 503 });
  }
}

export async function DELETE(req: Request): Promise<NextResponse<ApiResult<{ id: number }>>> {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }
  try {
    await deleteWatchlist(id);
    return NextResponse.json({ ok: true, data: { id } });
  } catch {
    return NextResponse.json({ ok: false, error: 'sqlserver_unavailable' }, { status: 503 });
  }
}

function fallbackWatchlist(): WatchlistItem[] {
  return ['AMD', 'ARM', 'NVDA'].map((symbol, index) => ({
    id: index + 1,
    symbol,
    name: `${symbol} demo`,
    note: 'Connect SQL Server to persist',
    created_at: new Date(0).toISOString(),
  }));
}
