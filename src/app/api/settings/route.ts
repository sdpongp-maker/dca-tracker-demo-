import { NextResponse } from 'next/server';
import { getActiveSymbol, setActiveSymbol } from '@/lib/db';
import type { ApiResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<ApiResult<{ active_symbol: string }>>> {
  try {
    return NextResponse.json({ ok: true, data: { active_symbol: await getActiveSymbol() } });
  } catch {
    return NextResponse.json({ ok: true, data: { active_symbol: 'AMD' } });
  }
}

export async function PATCH(req: Request): Promise<NextResponse<ApiResult<{ active_symbol: string }>>> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const symbol = String((body as { active_symbol?: unknown }).active_symbol ?? '');
  try {
    const active_symbol = await setActiveSymbol(symbol);
    return NextResponse.json({ ok: true, data: { active_symbol } });
  } catch {
    return NextResponse.json({ ok: false, error: 'sqlserver_unavailable' }, { status: 503 });
  }
}
